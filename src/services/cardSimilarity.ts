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

// Known Limited functional effect clauses
const EFFECT_PATTERNS = [
  { pattern: /destroy target creature/i, label: 'Creature Removal' },
  { pattern: /exile target creature/i, label: 'Exile Removal' },
  { pattern: /deals \d+ damage to (any target|target creature)/i, label: 'Burn / Direct Damage' },
  { pattern: /counter target (spell|noncreature spell|creature spell)/i, label: 'Counterspell' },
  { pattern: /draw (a|\d+) cards?/i, label: 'Card Draw' },
  { pattern: /target creature gets [+-]\d+\/[+-]\d+/i, label: 'Stat Modifier' },
  { pattern: /create (a|\d+) .* token/i, label: 'Token Creation' },
  { pattern: /put (a|\d+) \+1\/\+1 counter/i, label: '+1/+1 Counter' },
  { pattern: /return target .* to its owner's hand/i, label: 'Bounce Effect' },
  { pattern: /target creature can't (block|attack)/i, label: 'Evasion / Pacifism' },
  { pattern: /look at the top \d+ cards/i, label: 'Card Selection / Impulse' },
  { pattern: /when .* enters the battlefield|when .* enters/i, label: 'ETB Ability' },
  { pattern: /sacrifice/i, label: 'Sacrifice Synergy' },
  { pattern: /flying/i, label: 'Flying' },
  { pattern: /lifelink/i, label: 'Lifelink' },
  { pattern: /deathtouch/i, label: 'Deathtouch' },
  { pattern: /menace/i, label: 'Menace' },
  { pattern: /trample/i, label: 'Trample' },
  { pattern: /vigilance/i, label: 'Vigilance' },
  { pattern: /haste/i, label: 'Haste' },
  { pattern: /ward/i, label: 'Ward' },
  { pattern: /flash/i, label: 'Flash' },
];

/**
 * Extract functional clauses and keywords from a card
 */
export function extractCardFeatures(card: Card) {
  const typeLine = (card.type_line || '').toLowerCase();
  const oracle = (card.oracle_text || '').toLowerCase();

  const isCreature = typeLine.includes('creature');
  const isInstant = typeLine.includes('instant') || (card.keywords || []).some(k => k.toLowerCase() === 'flash');
  const isSorcery = typeLine.includes('sorcery');
  const isEnchantment = typeLine.includes('enchantment');
  const isArtifact = typeLine.includes('artifact');

  let primaryType = 'creature';
  if (isInstant) primaryType = 'instant';
  else if (isSorcery) primaryType = 'sorcery';
  else if (isEnchantment) primaryType = 'enchantment';
  else if (isArtifact) primaryType = 'artifact';
  else if (isCreature) primaryType = 'creature';

  const detectedClauses: { label: string; raw: string }[] = [];
  EFFECT_PATTERNS.forEach((ep) => {
    if (ep.pattern.test(oracle)) {
      const match = oracle.match(ep.pattern);
      detectedClauses.push({ label: ep.label, raw: match ? match[0] : ep.label });
    }
  });

  return {
    primaryType,
    isCreature,
    isInstant,
    isSorcery,
    detectedClauses,
    cmc: card.cmc,
    colors: card.colors.filter(c => c !== 'C'),
    power: card.power ? parseInt(card.power, 10) : undefined,
    toughness: card.toughness ? parseInt(card.toughness, 10) : undefined,
  };
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

  const queries: string[] = [];

  // Strategy 1: High Specificity (Matching Type, CMC exact, Color, and top detected clause)
  if (features.detectedClauses.length > 0) {
    const topClause = features.detectedClauses[0];
    queries.push(
      `${baseFilter} ${excludeSelf} t:${features.primaryType} ${colorQuery} cmc=${features.cmc} o:"${topClause.raw}"`
    );
  }

  // Strategy 2: Type + Color + CMC exact + any keyword/clause if available
  if (card.keywords && card.keywords.length > 0) {
    queries.push(
      `${baseFilter} ${excludeSelf} t:${features.primaryType} ${colorQuery} cmc=${features.cmc} o:"${card.keywords[0].toLowerCase()}"`
    );
  }

  // Strategy 3: Type + Color + CMC exact
  queries.push(
    `${baseFilter} ${excludeSelf} t:${features.primaryType} ${colorQuery} cmc=${features.cmc}`
  );

  // Strategy 4: Type + Color + CMC within +/- 1
  const minCmc = Math.max(1, features.cmc - 1);
  const maxCmc = features.cmc + 1;
  queries.push(
    `${baseFilter} ${excludeSelf} t:${features.primaryType} ${colorQuery} cmc>=${minCmc} cmc<=${maxCmc}`
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
 */
export function calculateCardSimilarity(target: Card, candidate: Card): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Primary Type Match (up to 25 pts)
  const targetType = (target.type_line || '').toLowerCase();
  const candType = (candidate.type_line || '').toLowerCase();
  if (
    (targetType.includes('creature') && candType.includes('creature')) ||
    (targetType.includes('instant') && candType.includes('instant')) ||
    (targetType.includes('sorcery') && candType.includes('sorcery')) ||
    (targetType.includes('enchantment') && candType.includes('enchantment')) ||
    (targetType.includes('artifact') && candType.includes('artifact'))
  ) {
    score += 25;
    reasons.push('Same card type');
  }

  // 2. CMC Proximity (up to 25 pts)
  const cmcDiff = Math.abs((target.cmc || 0) - (candidate.cmc || 0));
  if (cmcDiff === 0) {
    score += 25;
    reasons.push(`Exact CMC ${target.cmc}`);
  } else if (cmcDiff === 1) {
    score += 15;
    reasons.push('Close CMC (±1)');
  }

  // 3. Statline Match for Creatures (up to 15 pts)
  if (target.power !== undefined && target.toughness !== undefined && candidate.power !== undefined && candidate.toughness !== undefined) {
    const pDiff = Math.abs(parseInt(target.power, 10) - parseInt(candidate.power, 10));
    const tDiff = Math.abs(parseInt(target.toughness, 10) - parseInt(candidate.toughness, 10));
    if (pDiff === 0 && tDiff === 0) {
      score += 15;
      reasons.push(`Exact P/T (${target.power}/${target.toughness})`);
    } else if (pDiff <= 1 && tDiff <= 1) {
      score += 8;
      reasons.push('Comparable P/T ratio');
    }
  } else if (!targetType.includes('creature') && !candType.includes('creature')) {
    // For non-creatures, give neutral points to balance formula
    score += 15;
  }

  // 4. Tokenized Oracle & Keyword Jaccard Overlap (up to 35 pts)
  const targetTokens = tokenizeOracleText(target.oracle_text || '', target.name);
  const candTokens = tokenizeOracleText(candidate.oracle_text || '', candidate.name);

  if (targetTokens.size > 0 && candTokens.size > 0) {
    let intersection = 0;
    targetTokens.forEach((t) => {
      if (candTokens.has(t)) intersection++;
    });
    const union = new Set([...targetTokens, ...candTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const jaccardPoints = Math.round(jaccard * 35);
    score += jaccardPoints;

    if (jaccard > 0.3) {
      reasons.push('Strong rules text overlap');
    } else if (jaccard > 0.15) {
      reasons.push('Shared mechanic keywords');
    }
  }

  // Shared keywords
  const sharedKeywords = (target.keywords || []).filter(k => 
    (candidate.keywords || []).some(ck => ck.toLowerCase() === k.toLowerCase())
  );
  if (sharedKeywords.length > 0) {
    reasons.push(`Shared: ${sharedKeywords.slice(0, 2).join(', ')}`);
  }

  return {
    score: Math.min(100, Math.max(10, score)),
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

  // Score candidates against target card
  const scoredCandidates: { card: Card; score: number; reasons: string[] }[] = candidateCards.map((cand) => {
    const { score, reasons } = calculateCardSimilarity(targetCard, cand);
    return { card: cand, score, reasons };
  });

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
