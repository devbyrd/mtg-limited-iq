import { Card, GradeTier, MTGColor } from '../types/mtg';
import { normalizeScryfallCard } from './scryfall';
import { fetch17LandsSetData, winRateToGradeTier, gradeTierToIndex, indexToGradeTier } from './seventeenLands';
import { getLsvRatingForCard, lsvScoreToGradeTier } from './lsvRatings';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

// Benchmark modern premier booster draft sets with rich 17Lands sample sizes
export const COMPARABLE_PREMIER_SETS = [
  'BLB', 'OTJ', 'MKM', 'LCI', 'WOE', 'MOM', 'ONE', 'BRO', 'DMU', 'NEO', 'STX', 'KHM', 'DSK', 'FDN'
];

export interface SimilarCardMatch {
  card: Card;
  similarityScore: number; // 0 to 100%
  matchReasons: string[];
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
  lsvScore?: number;
  lsvGrade?: GradeTier;
  lsvVerdict?: string;
}

export interface HistoricalCompsConsensus {
  sampleCount: number;
  projectedTier: GradeTier;
  averageWinRate?: number;
  minWinRate?: number;
  maxWinRate?: number;
  tierRangeMin?: GradeTier;
  tierRangeMax?: GradeTier;
  averageLsvScore?: number;
  projectedLsvGrade?: GradeTier;
  summaryText: string;
}

export interface CardSimilarityResult {
  targetCard: Card;
  matches: SimilarCardMatch[];
  consensus: HistoricalCompsConsensus;
}

// In-memory session cache to avoid repeating Scryfall calls for the same card
const similarityCache = new Map<string, CardSimilarityResult>();

// Known Limited functional effect clauses with category classification
export interface EffectPattern {
  pattern: RegExp;
  label: string;
  category: 'removal' | 'damage' | 'counter' | 'draw' | 'selection' | 'trick' | 'bounce' | 'pacifism' | 'token' | 'counters' | 'sweeper' | 'synergy';
}

const EFFECT_PATTERNS: EffectPattern[] = [
  { pattern: /destroy target creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /exile target creature/i, label: 'Exile Removal', category: 'removal' },
  { pattern: /destroy target (permanent|nonland permanent)/i, label: 'Permanent Removal', category: 'removal' },
  { pattern: /exile target (permanent|nonland permanent)/i, label: 'Exile Permanent', category: 'removal' },
  { pattern: /deals \d+ damage to (any target|target creature)/i, label: 'Burn / Direct Damage', category: 'damage' },
  { pattern: /deals \d+ damage to each creature/i, label: 'Board Wipe / Sweeper', category: 'sweeper' },
  { pattern: /destroy all creatures/i, label: 'Board Wipe / Wrath', category: 'sweeper' },
  { pattern: /counter target (spell|noncreature spell|creature spell)/i, label: 'Counterspell', category: 'counter' },
  { pattern: /draw (a|\d+) cards?/i, label: 'Card Draw', category: 'draw' },
  { pattern: /target creature gets [+-]\d+\/[+-]\d+/i, label: 'Stat Modifier', category: 'trick' },
  { pattern: /create (a|\d+) .* token/i, label: 'Token Creation', category: 'token' },
  { pattern: /put (a|\d+) \+1\/\+1 counter/i, label: '+1/+1 Counter', category: 'counters' },
  { pattern: /return target .* to its owner's hand/i, label: 'Bounce Effect', category: 'bounce' },
  { pattern: /target creature can't (block|attack)/i, label: 'Pacifism / Lock', category: 'pacifism' },
  { pattern: /enchanted creature (can't attack|can't block|doesn't untap)/i, label: 'Pacifism Aura', category: 'pacifism' },
  { pattern: /look at the top \d+ cards/i, label: 'Card Selection / Impulse', category: 'selection' },
  { pattern: /when .* enters the battlefield|when .* enters/i, label: 'ETB Ability', category: 'synergy' },
  { pattern: /sacrifice/i, label: 'Sacrifice Synergy', category: 'synergy' },
];

export const COMBAT_KEYWORDS = [
  'flying', 'lifelink', 'deathtouch', 'menace', 'trample', 
  'vigilance', 'haste', 'ward', 'flash', 'reach', 'first strike', 'double strike'
];

/**
 * Extract functional clauses and keywords from a card
 */
export function extractCardFeatures(card: Card) {
  const typeLine = (card.type_line || '').toLowerCase();
  const oracle = (card.oracle_text || '').toLowerCase();

  const isCreature = typeLine.includes('creature');
  const hasFlash = (card.keywords || []).some(k => k.toLowerCase() === 'flash') || oracle.includes('flash');
  const isInstant = typeLine.includes('instant') || hasFlash;
  const isSorcery = typeLine.includes('sorcery');
  const isEnchantment = typeLine.includes('enchantment');
  const isArtifact = typeLine.includes('artifact');

  let primaryType = 'creature';
  if (isInstant) primaryType = 'instant';
  else if (isSorcery) primaryType = 'sorcery';
  else if (isEnchantment) primaryType = 'enchantment';
  else if (isArtifact) primaryType = 'artifact';
  else if (isCreature) primaryType = 'creature';

  const isCombatTrick = (isInstant || hasFlash) && (
    /target creature gets [+-]\d+\/[+-]\d+/i.test(oracle) ||
    /gains (hexproof|indestructible|flying|first strike|lifelink|deathtouch)/i.test(oracle) ||
    /untap target creature/i.test(oracle)
  );

  const isAuraRemoval = isEnchantment && (
    oracle.includes('enchant creature') || oracle.includes('enchant permanent')
  ) && (
    oracle.includes("can't attack") || oracle.includes("can't block") || 
    oracle.includes("doesn't untap") || oracle.includes("exile")
  );

  const createsTokens = oracle.includes('create') && oracle.includes('token');

  const detectedClauses: { label: string; raw: string; category: string }[] = [];
  const detectedCategories = new Set<string>();

  EFFECT_PATTERNS.forEach((ep) => {
    if (ep.pattern.test(oracle)) {
      const match = oracle.match(ep.pattern);
      detectedClauses.push({ label: ep.label, raw: match ? match[0] : ep.label, category: ep.category });
      detectedCategories.add(ep.category);
    }
  });

  if (isAuraRemoval) {
    detectedCategories.add('removal');
    detectedCategories.add('pacifism');
  }

  // Effective CMC accounting for the Instant Speed Tax (-0.75 for instant/flash)
  const effectiveCmc = (isInstant || hasFlash) ? Math.max(0.5, (card.cmc || 0) - 0.75) : (card.cmc || 0);

  return {
    primaryType,
    isCreature,
    isInstant,
    isSorcery,
    isEnchantment,
    isArtifact,
    hasFlash,
    isCombatTrick,
    isAuraRemoval,
    createsTokens,
    detectedClauses,
    detectedCategories,
    cmc: card.cmc || 0,
    effectiveCmc,
    colors: card.colors.filter(c => c !== 'C'),
    power: card.power !== undefined ? parseInt(card.power, 10) : undefined,
    toughness: card.toughness !== undefined ? parseInt(card.toughness, 10) : undefined,
  };
}

/**
 * Validates whether two cards are functionally compatible to be compared.
 * Card type acts as a hard filter / compatibility matrix (0 arbitrary points in score).
 */
export function areCardTypesCompatible(target: Card, candidate: Card): boolean {
  const tFeatures = extractCardFeatures(target);
  const cFeatures = extractCardFeatures(candidate);

  // 1. Creatures
  if (tFeatures.isCreature || cFeatures.isCreature) {
    // A creature can compare to another creature, or to a spell that produces creature tokens
    return (tFeatures.isCreature && cFeatures.isCreature) ||
           (tFeatures.isCreature && cFeatures.createsTokens) ||
           (cFeatures.isCreature && tFeatures.createsTokens);
  }

  // 2. Non-permanent spells (Instants & Sorceries)
  const tSpell = tFeatures.isInstant || tFeatures.isSorcery;
  const cSpell = cFeatures.isInstant || cFeatures.isSorcery;

  if (tSpell && cSpell) {
    // Combat tricks must match instant speed
    if (tFeatures.isCombatTrick && !cFeatures.isInstant) return false;
    if (cFeatures.isCombatTrick && !tFeatures.isInstant) return false;
    return true;
  }

  // 3. Aura Removal can compare to Sorcery/Instant removal
  if (tFeatures.isAuraRemoval && (cSpell || cFeatures.isAuraRemoval)) return true;
  if (cFeatures.isAuraRemoval && (tSpell || tFeatures.isAuraRemoval)) return true;

  // 4. Artifacts and Enchantments
  if (tFeatures.isArtifact && cFeatures.isArtifact) return true;
  if (tFeatures.isEnchantment && cFeatures.isEnchantment) return true;

  return false;
}

/**
 * Construct Scryfall search queries with fallback tiers
 */
function buildScryfallQueries(card: Card, features: ReturnType<typeof extractCardFeatures>): string[] {
  const setFilter = `(${COMPARABLE_PREMIER_SETS.map(s => `s:${s.toLowerCase()}`).join(' or ')})`;
  const baseFilter = `is:booster -is:reprint -t:basic -t:token ${setFilter}`;

  // Exclude the current set and exact same card name
  const excludeSelf = `-s:${card.set.toLowerCase()} -!"${card.name}"`;

  const colorQuery = features.colors.length > 0 
    ? (features.colors.length === 1 ? `c:${features.colors[0]}` : `c<=${features.colors.join('')}`)
    : 'c:c';

  // Cross-pollinate Instants and Sorceries across spell removal/burn/draw
  let typeFilter = `t:${features.primaryType}`;
  if (features.isInstant || features.isSorcery || features.isAuraRemoval) {
    if (features.isCombatTrick) {
      typeFilter = '(t:instant or o:flash)';
    } else {
      typeFilter = '(t:instant or t:sorcery)';
    }
  } else if (features.isCreature) {
    typeFilter = 't:creature';
  }

  const minCmc = Math.max(1, features.cmc - 1);
  const maxCmc = features.cmc + 1;

  const queries: string[] = [];

  // Strategy 1: High Specificity (Matching functional clause + compatible type + color + CMC window)
  if (features.detectedClauses.length > 0) {
    const topClause = features.detectedClauses[0];
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${colorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"${topClause.raw}"`
    );
  }

  // Strategy 2: Keyword overlap if present
  if (card.keywords && card.keywords.length > 0) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${colorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"${card.keywords[0].toLowerCase()}"`
    );
  }

  // Strategy 3: Compatible type + exact CMC + color
  queries.push(
    `${baseFilter} ${excludeSelf} ${typeFilter} ${colorQuery} cmc=${features.cmc}`
  );

  // Strategy 4: Compatible type + CMC within ±1 + color
  queries.push(
    `${baseFilter} ${excludeSelf} ${typeFilter} ${colorQuery} cmc>=${minCmc} cmc<=${maxCmc}`
  );

  return queries;
}

/**
 * Tokenize oracle text for similarity comparison (ignoring stop words and card names)
 */
function tokenizeOracleText(text: string, cardName: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'in', 'on', 'with', 'by', 'at', 'this', 'that', 'it', 'or', 'for', 'you', 'your', 'target']);
  const sanitized = text
    .toLowerCase()
    .replace(new RegExp(cardName.toLowerCase(), 'g'), '~')
    .replace(/[^a-z0-9~+/\-]/g, ' ');

  const tokens = sanitized.split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t));
  return new Set(tokens);
}

/**
 * Compute functional similarity score between 0 and 100%
 *
 * Weight Distribution:
 * - Card Type: 0 pts (Acts as Compatibility Gatekeeper filter)
 * - Functional Effect & Role: 50 pts (Primary effect clause + keywords + token overlap)
 * - Speed-Adjusted Effective Mana Cost: 30 pts (Includes the 0.75 Instant Speed Tax)
 * - Statline & Output Scale: 20 pts (Creature body efficiency or spell magnitude)
 */
export function calculateCardSimilarity(target: Card, candidate: Card): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // 0. Compatibility Gatekeeper (Prerequisite — 0 points)
  if (!areCardTypesCompatible(target, candidate)) {
    return { score: 0, reasons: [] };
  }

  const tFeatures = extractCardFeatures(target);
  const cFeatures = extractCardFeatures(candidate);

  let functionalScore = 0;
  let cmcScore = 0;
  let statlineScore = 0;

  // =========================================================================
  // PILLAR 1: Functional Effect & Role Archetype (up to 50 pts)
  // =========================================================================
  // 1a. Core Effect Category Match (up to 32 pts)
  let bestCategoryMatch = 0;
  let matchedCategoryLabel = '';

  const CATEGORY_SCORES: Record<string, { pts: number; label: string }> = {
    removal: { pts: 32, label: 'Matching creature removal effect' },
    sweeper: { pts: 32, label: 'Matching board wipe effect' },
    damage: { pts: 30, label: 'Matching direct damage / burn' },
    counter: { pts: 30, label: 'Matching counterspell effect' },
    draw: { pts: 28, label: 'Matching card advantage effect' },
    trick: { pts: 28, label: 'Matching combat trick effect' },
    pacifism: { pts: 28, label: 'Matching pacifism / lockdown' },
    bounce: { pts: 26, label: 'Matching bounce tempo effect' },
    selection: { pts: 24, label: 'Matching card selection effect' },
    token: { pts: 24, label: 'Matching token creation' },
    counters: { pts: 22, label: 'Matching counter synergy' },
    synergy: { pts: 18, label: 'Matching ETB / synergy trigger' },
  };

  tFeatures.detectedCategories.forEach((cat) => {
    if (cFeatures.detectedCategories.has(cat)) {
      const cfg = CATEGORY_SCORES[cat];
      if (cfg && cfg.pts > bestCategoryMatch) {
        bestCategoryMatch = cfg.pts;
        matchedCategoryLabel = cfg.label;
      }
    }
  });

  if (bestCategoryMatch > 0) {
    functionalScore += bestCategoryMatch;
    reasons.push(matchedCategoryLabel);
  } else if (tFeatures.isCreature && cFeatures.isCreature) {
    // Both are creatures without special detected clauses (vanilla / french vanilla)
    functionalScore += 16;
  }

  // 1b. Keyword & Rules Text Overlap (up to 18 pts)
  const sharedKeywords = (target.keywords || []).filter(k =>
    (candidate.keywords || []).some(ck => ck.toLowerCase() === k.toLowerCase())
  );
  if (sharedKeywords.length > 0) {
    const kwPoints = Math.min(12, sharedKeywords.length * 6);
    functionalScore += kwPoints;
    reasons.push(`Shared: ${sharedKeywords.slice(0, 2).join(', ')}`);
  }

  const targetTokens = tokenizeOracleText(target.oracle_text || '', target.name);
  const candTokens = tokenizeOracleText(candidate.oracle_text || '', candidate.name);
  if (targetTokens.size > 0 && candTokens.size > 0) {
    let intersection = 0;
    targetTokens.forEach(t => { if (candTokens.has(t)) intersection++; });
    const union = new Set([...targetTokens, ...candTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const jaccardPoints = Math.round(jaccard * 10);
    functionalScore += jaccardPoints;
    if (jaccard > 0.25 && !reasons.some(r => r.includes('rules text'))) {
      reasons.push('High rules text overlap');
    }
  }

  functionalScore = Math.min(50, functionalScore);

  // =========================================================================
  // PILLAR 2: Speed-Adjusted Effective Mana Cost (up to 30 pts)
  // =========================================================================
  const effectiveDiff = Math.abs(tFeatures.effectiveCmc - cFeatures.effectiveCmc);
  const targetIsInstant = tFeatures.isInstant;
  const candIsInstant = cFeatures.isInstant;

  if (effectiveDiff <= 0.15) {
    cmcScore = 30;
    if (targetIsInstant && !candIsInstant) {
      reasons.push(`Speed-parity (${target.cmc}M instant ≈ ${candidate.cmc}M sorcery)`);
    } else if (!targetIsInstant && candIsInstant) {
      reasons.push(`Speed-parity (${target.cmc}M sorcery ≈ ${candidate.cmc}M instant)`);
    } else {
      reasons.push(`Exact CMC ${target.cmc}`);
    }
  } else if (effectiveDiff <= 0.4) {
    cmcScore = 27;
    reasons.push(`Near-identical tempo (±${effectiveDiff.toFixed(1)} mana)`);
  } else if (effectiveDiff <= 0.85) {
    cmcScore = 21;
    if (targetIsInstant !== candIsInstant) {
      reasons.push(targetIsInstant ? 'Instant speed tax (+0.75 mana)' : 'Sorcery speed discount');
    } else {
      reasons.push('Close CMC (±1)');
    }
  } else if (effectiveDiff <= 1.35) {
    cmcScore = 14;
    reasons.push('Acceptable curve slot (±1)');
  } else if (effectiveDiff <= 2.0) {
    cmcScore = 7;
  } else {
    cmcScore = 0;
  }

  // =========================================================================
  // PILLAR 3: Statline & Output Scale (up to 20 pts)
  // =========================================================================
  if (tFeatures.isCreature && cFeatures.isCreature && 
      tFeatures.power !== undefined && tFeatures.toughness !== undefined &&
      cFeatures.power !== undefined && cFeatures.toughness !== undefined) {
    const pDiff = Math.abs(tFeatures.power - cFeatures.power);
    const tDiff = Math.abs(tFeatures.toughness - cFeatures.toughness);
    const totalStatDiff = Math.abs((tFeatures.power + tFeatures.toughness) - (cFeatures.power + cFeatures.toughness));

    if (pDiff === 0 && tDiff === 0) {
      statlineScore = 20;
      reasons.push(`Exact P/T (${target.power}/${target.toughness})`);
    } else if (totalStatDiff === 0) {
      statlineScore = 16;
      reasons.push(`Equivalent total stats (${tFeatures.power + tFeatures.toughness})`);
    } else if (totalStatDiff <= 1) {
      statlineScore = 12;
      reasons.push('Comparable P/T ratio');
    } else if (totalStatDiff <= 2) {
      statlineScore = 6;
    }
  } else if (!tFeatures.isCreature && !cFeatures.isCreature) {
    // Non-creature output scaling (e.g. removal target unrestricted vs conditional, damage amounts)
    const tOracle = (target.oracle_text || '').toLowerCase();
    const cOracle = (candidate.oracle_text || '').toLowerCase();

    // Direct damage extraction
    const tDmg = tOracle.match(/deals (\d+) damage/);
    const cDmg = cOracle.match(/deals (\d+) damage/);
    if (tDmg && cDmg) {
      const dmgDiff = Math.abs(parseInt(tDmg[1], 10) - parseInt(cDmg[1], 10));
      if (dmgDiff === 0) {
        statlineScore = 20;
        reasons.push(`Exact damage (${tDmg[1]} dmg)`);
      } else if (dmgDiff === 1) {
        statlineScore = 14;
        reasons.push('Comparable burn scale (±1 dmg)');
      } else {
        statlineScore = 8;
      }
    } else if (tFeatures.detectedCategories.has('removal') && cFeatures.detectedCategories.has('removal')) {
      const tUnrestricted = /destroy target (creature|permanent)|exile target (creature|permanent)/i.test(tOracle);
      const cUnrestricted = /destroy target (creature|permanent)|exile target (creature|permanent)/i.test(cOracle);
      if (tUnrestricted && cUnrestricted) {
        statlineScore = 18;
        reasons.push('Unrestricted target removal');
      } else {
        statlineScore = 14;
      }
    } else {
      // General non-creature baseline parity
      statlineScore = 15;
    }
  } else {
    // Hybrid (e.g. creature vs token spell)
    statlineScore = 12;
  }

  const totalScore = Math.min(100, Math.max(0, functionalScore + cmcScore + statlineScore));

  return {
    score: totalScore,
    reasons: reasons.slice(0, 3),
  };
}

/**
 * Main engine: Finds similar cards from past sets, pulls their 17Lands & LSV ratings,
 * and synthesizes an empirical consensus projection.
 */
export async function findSimilarCards(targetCard: Card): Promise<CardSimilarityResult> {
  const cacheKey = `${targetCard.set.toUpperCase()}_${targetCard.name.toUpperCase()}`;
  if (similarityCache.has(cacheKey)) {
    return similarityCache.get(cacheKey)!;
  }

  const features = extractCardFeatures(targetCard);
  const queries = buildScryfallQueries(targetCard, features);

  let candidateCards: Card[] = [];

  // Try queries in order of specificity until we get at least 4 candidate cards
  for (const q of queries) {
    try {
      const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(q)}&order=released&dir=desc`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'SpellslingerArcana/1.0',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length > 0) {
          const rawCards = data.data.map((rc: any) => normalizeScryfallCard(rc));
          // Filter duplicates by card name
          rawCards.forEach((c: Card) => {
            if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase())) {
              candidateCards.push(c);
            }
          });
        }
      }
    } catch (err) {
      console.warn('Similarity search query failed:', err);
    }

    if (candidateCards.length >= 6) {
      break;
    }
  }

  // Score candidates against target card (filtering out incompatible or irrelevant matches)
  const scoredCandidates: { card: Card; score: number; reasons: string[] }[] = [];
  for (const cand of candidateCards) {
    const { score, reasons } = calculateCardSimilarity(targetCard, cand);
    if (score >= 20) {
      scoredCandidates.push({ card: cand, score, reasons });
    }
  }

  // Sort by highest similarity
  scoredCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCandidates.slice(0, 6);

  // Group by set to batch-fetch 17Lands datasets
  const neededSets = Array.from(new Set(topCandidates.map(c => c.card.set.toUpperCase())));
  const setDatasets: Record<string, any> = {};

  await Promise.all(
    neededSets.map(async (setCode) => {
      try {
        const data = await fetch17LandsSetData(setCode);
        if (data) {
          setDatasets[setCode] = data;
        }
      } catch (e) {}
    })
  );

  // Assemble enriched matches with 17Lands and LSV data
  const matches: SimilarCardMatch[] = topCandidates.map(({ card, score, reasons }) => {
    const setCode = card.set.toUpperCase();
    const setData = setDatasets[setCode];
    const card17L = setData?.cards?.[card.name];

    let winRate = card17L?.win_rate;
    let alsa = card17L?.avg_seen;
    let tierGrade: GradeTier | undefined = card17L?.tier_grade || (typeof winRate === 'number' ? winRateToGradeTier(winRate) : undefined);

    const lsvRating = getLsvRatingForCard(card);

    return {
      card,
      similarityScore: score,
      matchReasons: reasons,
      winRate,
      alsa,
      tierGrade,
      lsvScore: lsvRating.score,
      lsvGrade: lsvRating.grade,
      lsvVerdict: lsvRating.verdict,
    };
  });

  // Calculate consensus
  const consensus = calculateHistoricalConsensus(matches, targetCard);

  const result: CardSimilarityResult = {
    targetCard,
    matches,
    consensus,
  };

  similarityCache.set(cacheKey, result);
  return result;
}

/**
 * Calculates historical consensus projection based on the comps
 */
export function calculateHistoricalConsensus(matches: SimilarCardMatch[], targetCard: Card): HistoricalCompsConsensus {
  if (matches.length === 0) {
    return {
      sampleCount: 0,
      projectedTier: 'C',
      summaryText: 'Insufficient historical comps available to project a consensus grade.',
    };
  }

  const valid17L = matches.filter(m => typeof m.winRate === 'number');
  const validLsv = matches.filter(m => typeof m.lsvScore === 'number');

  let avgWinRate: number | undefined;
  let minWinRate: number | undefined;
  let maxWinRate: number | undefined;
  let tierRangeMin: GradeTier | undefined;
  let tierRangeMax: GradeTier | undefined;
  let projectedTier: GradeTier = 'C';

  if (valid17L.length > 0) {
    const rates = valid17L.map(m => m.winRate!);
    avgWinRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    minWinRate = Math.min(...rates);
    maxWinRate = Math.max(...rates);

    projectedTier = winRateToGradeTier(avgWinRate);
    tierRangeMin = winRateToGradeTier(minWinRate);
    tierRangeMax = winRateToGradeTier(maxWinRate);
  } else if (validLsv.length > 0) {
    const scores = validLsv.map(m => m.lsvScore!);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    projectedTier = lsvScoreToGradeTier(avgScore);
  }

  let avgLsv: number | undefined;
  let projectedLsv: GradeTier | undefined;
  if (validLsv.length > 0) {
    const scores = validLsv.map(m => m.lsvScore!);
    avgLsv = scores.reduce((a, b) => a + b, 0) / scores.length;
    projectedLsv = lsvScoreToGradeTier(avgLsv);
  }

  const typeDesc = targetCard.type_line ? targetCard.type_line.split('—')[0].trim() : 'card';
  const cmcDesc = `${targetCard.cmc}-mana`;
  const summaryText = valid17L.length > 0
    ? `Based on ${valid17L.length} comparable ${cmcDesc} ${typeDesc} cards across recent formats, historical win rates average ${(avgWinRate! * 100).toFixed(1)}% (${projectedTier}).`
    : `Based on expert ratings for ${matches.length} comparable cards, the consensus baseline is ${projectedTier}.`;

  return {
    sampleCount: matches.length,
    projectedTier,
    averageWinRate: avgWinRate,
    minWinRate,
    maxWinRate,
    tierRangeMin,
    tierRangeMax,
    averageLsvScore: avgLsv,
    projectedLsvGrade: projectedLsv,
    summaryText,
  };
}
