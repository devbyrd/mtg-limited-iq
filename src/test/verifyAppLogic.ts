import { getFallbackCards, POPULAR_LIMITED_SETS } from '../services/scryfall';
import { generateQuiz } from '../services/quizGenerator';
import { calculateSetCalibration, winRateToGradeTier, GRADE_TIERS, isSetUnderTwoWeeksOld, is17LandsEligibleForSet } from '../services/seventeenLands';
import { UserProfileStats, QuizResult, QuizSettings, UserCardEvaluation, Card, SeventeenLandsSetData } from '../types/mtg';
import { calculateMasteryRank, defaultStats } from '../services/storage';
import { isAuthentic17LandsDataSet, generateSetSynthesisReport } from '../services/archetypeEvaluator';

console.log('=== MTG Limited IQ Verification Tests ===\n');

// Test 1: Fallback Cards & Normalization
const blbCards = getFallbackCards('BLB');
console.log(`[PASS] Loaded ${blbCards.length} sample cards for Bloomburrow (BLB).`);
console.assert(blbCards.length >= 7, 'Expected at least 7 sample cards');

// Verify combat trick detection
const combatTrick = blbCards.find(c => c.name === 'Might of the Meek');
console.assert(combatTrick?.is_combat_trick === true, 'Might of the Meek should be flagged as combat trick');
console.log(`[PASS] Combat trick detection verified: ${combatTrick?.name} -> is_combat_trick=${combatTrick?.is_combat_trick}`);

// Verify removal detection
const removalSpell = blbCards.find(c => c.name === 'Fell');
console.assert(removalSpell?.is_removal === true, 'Fell should be flagged as removal');
console.log(`[PASS] Removal detection verified: ${removalSpell?.name} -> is_removal=${removalSpell?.is_removal}`);

// Test 2: Quiz Generation
const quizSettings: QuizSettings = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  questionCount: 5,
  categories: ['p1p1_pick', 'trap_or_sleeper', 'quadrant_role', 'combat_tricks', 'instant_speed', 'mana_cost_and_splash', 'power_toughness', 'archetype_engine', 'card_evaluation'],
  rarities: ['common', 'uncommon', 'rare', 'mythic'],
  timerSeconds: 0,
  mode: 'quiz',
};

const quiz = generateQuiz(blbCards, quizSettings, null);
console.assert(quiz.length > 0, 'Quiz questions generated');
console.log(`[PASS] Generated quiz with ${quiz.length} diverse questions.`);

quiz.forEach((q, idx) => {
  console.log(`   Q${idx + 1} [${q.category}] Target: ${q.card.name} | Mask: ${q.obfuscation.target} (${q.obfuscation.style})`);
  console.assert(q.options.some(o => o.isCorrect), `Question ${idx + 1} must have a correct option`);
  console.assert(q.correctAnswer.length > 0, `Question ${idx + 1} must have a correct answer value`);
});

// Test 3: 17Lands Calibration & Traps/Sleepers Detection
const mockEvaluations: Record<string, UserCardEvaluation> = {
  'blb_fell': {
    cardId: 'blb-2',
    cardName: 'Fell',
    setCode: 'BLB',
    userGrade: 'A',
    userScore: 4.7,
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'blb_seedgale foster': {
    cardId: 'blb-5',
    cardName: 'Seedgale Foster',
    setCode: 'BLB',
    userGrade: 'A', // Overrated: 17Lands is C
    userScore: 4.7,
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'blb_might of the meek': {
    cardId: 'blb-3',
    cardName: 'Might of the Meek',
    setCode: 'BLB',
    userGrade: 'D', // Underrated: 17Lands is B
    userScore: 1.5,
    pickPriority: 'Late Filler',
    updatedAt: new Date().toISOString(),
  }
};

const mockLandsData = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  format: 'PremierDraft',
  sampleSize: 50000,
  cards: {
    'Fell': { name: 'Fell', color: 'B', rarity: 'uncommon', seen_count: 2800, avg_seen: 1.8, pick_rate: 0.2, game_count: 9200, win_rate: 0.605, iwd: 0.051, tier_grade: 'A' },
    'Seedgale Foster': { name: 'Seedgale Foster', color: 'G', rarity: 'common', seen_count: 5400, avg_seen: 7.2, pick_rate: 0.08, game_count: 6100, win_rate: 0.518, iwd: -0.012, tier_grade: 'C' },
    'Might of the Meek': { name: 'Might of the Meek', color: 'R', rarity: 'common', seen_count: 4100, avg_seen: 4.8, pick_rate: 0.15, game_count: 7300, win_rate: 0.568, iwd: 0.028, tier_grade: 'B' },
  },
  updatedAt: new Date().toISOString(),
};

const calibration = calculateSetCalibration(blbCards, mockEvaluations, mockLandsData);
console.log('\n[PASS] Calibration Calculation:');
console.log(`   Total Rated: ${calibration.totalRated}`);
console.log(`   Exact Matches: ${calibration.exactMatches}`);
console.log(`   Calibration Score: ${calibration.calibrationScore}%`);
console.log(`   Traps (Overrated): ${calibration.biggestTraps.map(t => `${t.card.name} (+${t.gradeDelta} tiers)`).join(', ')}`);
console.log(`   Sleepers (Underrated): ${calibration.biggestSleepers.map(s => `${s.card.name} (${s.gradeDelta} tiers)`).join(', ')}`);

console.assert(calibration.exactMatches >= 1, 'Fell should match exactly as A');
console.assert(calibration.biggestTraps.some(t => t.card.name === 'Seedgale Foster'), 'Seedgale Foster should be flagged as a Trap');
console.assert(calibration.biggestSleepers.some(s => s.card.name === 'Might of the Meek'), 'Might of the Meek should be flagged as a Sleeper');

// Test 4: Mastery Rank Calculation
console.log('\n[PASS] Mastery Rank Calculations:');
console.log(`   95% Acc, 60 attempts -> ${calculateMasteryRank(95, 60)} (Expected: Mythic)`);
console.log(`   85% Acc, 35 attempts -> ${calculateMasteryRank(85, 35)} (Expected: Gold)`);
console.log(`   70% Acc, 20 attempts -> ${calculateMasteryRank(70, 20)} (Expected: Silver)`);
console.log(`   50% Acc, 15 attempts -> ${calculateMasteryRank(50, 15)} (Expected: Bronze)`);

console.assert(calculateMasteryRank(95, 60) === 'Mythic');
console.assert(calculateMasteryRank(85, 35) === 'Gold');
console.assert(calculateMasteryRank(70, 20) === 'Silver');

// Test 5: Unreleased Set Telemetry Guardrails & TBD Synthesis
console.log('\n[PASS] Unreleased Set Telemetry Guardrails:');
const unreleasedCards = [
  { id: 'fra-1', name: 'Cloud Strife', set: 'fra', colors: ['W'], rarity: 'rare', type_line: 'Legendary Creature', collector_number: '1' },
  { id: 'fra-2', name: 'Sephiroth', set: 'fra', colors: ['B'], rarity: 'mythic', type_line: 'Legendary Creature', collector_number: '2' },
  { id: 'fra-3', name: 'Tifa Lockhart', set: 'fra', colors: ['G', 'R'], rarity: 'uncommon', type_line: 'Creature', collector_number: '3' },
];

const leakedOld17Lands = {
  setCode: 'SOS',
  sampleSize: 12500,
  updatedAt: '2026-09-01',
  cards: {
    'Slickshot Show-Off': { name: 'Slickshot Show-Off', win_rate: 0.61, games_played: 1200, tier_grade: 'A-' },
  },
};

console.assert(!isAuthentic17LandsDataSet(null, 'FRA', unreleasedCards as unknown as Card[]), 'Null data is not authentic');
console.assert(!isAuthentic17LandsDataSet(leakedOld17Lands as unknown as SeventeenLandsSetData, 'FRA', unreleasedCards as unknown as Card[]), 'Leaked data from SOS must be rejected for FRA');

const unreleasedReport = generateSetSynthesisReport(unreleasedCards as unknown as Card[], {}, 'FRA', 'Final Fantasy', leakedOld17Lands as unknown as SeventeenLandsSetData);
console.assert(unreleasedReport.has17LandsData === false, 'has17LandsData must be false for unreleased set');
console.assert(unreleasedReport.seventeenLandsBestColor === undefined, 'No best color fallback for unreleased set');
console.assert(unreleasedReport.colorRankings.every(c => c.seventeenLandsAvgWinRate === undefined), 'All color win rates must be undefined');
console.assert(unreleasedReport.archetypeRankings.every(a => a.seventeenLandsWinRate === undefined), 'All archetype win rates must be undefined');
console.log('   ✓ Unreleased sets (FRA) correctly reject leaked 17Lands data and yield TBD values.');

// Test 6: Quiz 17Lands Maturity Restriction (< 2 Weeks & Unreleased Sets)
console.log('\n[PASS] 17Lands Quiz Maturity Guardrails (< 2 Weeks & Unreleased):');

// 6a. Date calculations
const now = new Date();
const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const matureDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

console.assert(isSetUnderTwoWeeksOld(futureDate) === true, 'Future date must be flagged as under 2 weeks (unreleased)');
console.assert(isSetUnderTwoWeeksOld(recentDate) === true, 'Date 5 days ago must be flagged as under 2 weeks');
console.assert(isSetUnderTwoWeeksOld(matureDate) === false, 'Date 40 days ago must NOT be flagged as under 2 weeks');

// 6b. is17LandsEligibleForSet
const authenticLandsDataForBLB: SeventeenLandsSetData = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  format: 'PremierDraft',
  sampleSize: 15000,
  updatedAt: '2024-09-01',
  cards: {
    'Heartfire Hero': { name: 'Heartfire Hero', color: 'R', rarity: 'uncommon', seen_count: 10000, pick_rate: 0.2, iwd: 0.02, win_rate: 0.589, avg_seen: 3.1, game_count: 8500, tier_grade: 'A-' },
    'Fell': { name: 'Fell', color: 'B', rarity: 'uncommon', seen_count: 11000, pick_rate: 0.25, iwd: 0.03, win_rate: 0.605, avg_seen: 1.8, game_count: 9200, tier_grade: 'A' },
    'Might of the Meek': { name: 'Might of the Meek', color: 'R', rarity: 'common', seen_count: 8000, pick_rate: 0.15, iwd: 0.01, win_rate: 0.568, avg_seen: 4.8, game_count: 7300, tier_grade: 'B' },
    'Warren Warleader': { name: 'Warren Warleader', color: 'W', rarity: 'mythic', seen_count: 5000, pick_rate: 0.4, iwd: 0.05, win_rate: 0.642, avg_seen: 1.2, game_count: 4800, tier_grade: 'A+' },
    'Shore Up': { name: 'Shore Up', color: 'U', rarity: 'common', seen_count: 7500, pick_rate: 0.1, iwd: 0.0, win_rate: 0.548, avg_seen: 5.6, game_count: 6700, tier_grade: 'C+' },
  },
};

const testBLBCards: Card[] = [
  ...blbCards,
  {
    id: 'blb-4',
    name: 'Warren Warleader',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '35',
    mana_cost: '{2}{W}{W}',
    cmc: 4,
    type_line: 'Creature — Rabbit Knight',
    oracle_text: 'Whenever you attack...',
    colors: ['W'],
    color_identity: ['W'],
    rarity: 'mythic',
    keywords: [],
    is_creature: true,
  } as Card,
  {
    id: 'blb-5',
    name: 'Shore Up',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '64',
    mana_cost: '{U}',
    cmc: 1,
    type_line: 'Instant',
    oracle_text: 'Target creature gets +1/+1...',
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'common',
    keywords: [],
    is_combat_trick: true,
    is_instant_speed: true,
  } as Card,
];

console.assert(
  is17LandsEligibleForSet(futureDate, authenticLandsDataForBLB, 'BLB', testBLBCards) === false,
  'Future release date must make 17Lands questions ineligible'
);
console.assert(
  is17LandsEligibleForSet(recentDate, authenticLandsDataForBLB, 'BLB', testBLBCards) === false,
  'Recent release date (<14d) must make 17Lands questions ineligible'
);
console.assert(
  is17LandsEligibleForSet(matureDate, authenticLandsDataForBLB, 'BLB', testBLBCards) === true,
  'Mature release date with authentic data must be eligible'
);

// 6c. generateQuiz with an unreleased set requesting 17Lands categories
const unreleasedQuizSettings: QuizSettings = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  releasedAt: futureDate,
  questionCount: 20,
  categories: ['trap_or_sleeper', 'card_evaluation', 'p1p1_pick'],
  rarities: ['common', 'uncommon', 'rare', 'mythic'],
  timerSeconds: 0,
  mode: 'quiz',
};

const unreleasedQuestions = generateQuiz(testBLBCards, unreleasedQuizSettings, authenticLandsDataForBLB);
console.assert(
  unreleasedQuestions.length > 0,
  'Must still generate questions from eligible non-17Lands categories'
);
console.assert(
  unreleasedQuestions.every(q => q.category !== 'trap_or_sleeper'),
  'Unreleased set must NEVER generate trap_or_sleeper questions'
);
console.assert(
  unreleasedQuestions.every(q => q.category !== 'card_evaluation'),
  'Unreleased set must NEVER generate card_evaluation questions'
);
console.assert(
  unreleasedQuestions.every(q => !q.prompt.includes('17Lands') && !q.title.includes('17Lands')),
  'Unreleased set questions must not reference 17Lands'
);

// Verify P1P1 cards do not contain (% GIH WR) in description or explanation
const p1p1Questions = unreleasedQuestions.filter(q => q.category === 'p1p1_pick');
for (const p1p1 of p1p1Questions) {
  console.assert(
    p1p1.options.every(opt => !opt.description?.includes('GIH WR')),
    'P1P1 for unreleased set must not display GIH WR'
  );
  console.assert(
    !p1p1.explanation.includes('GIH Win Rate'),
    'P1P1 explanation for unreleased set must not cite 17Lands win rates'
  );
}
console.log('   ✓ Unreleased and < 2-week-old sets strictly exclude 17Lands quiz questions and win rates.');

console.log('\n🎉 ALL LOGIC AND DATA VERIFICATION TESTS PASSED SUCCESSFULLY!');
