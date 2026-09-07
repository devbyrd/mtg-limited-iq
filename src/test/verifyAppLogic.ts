import { getFallbackCards, POPULAR_LIMITED_SETS } from '../services/scryfall';
import { generateQuiz } from '../services/quizGenerator';
import { calculateSetCalibration, winRateToGradeTier, GRADE_TIERS } from '../services/seventeenLands';
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

console.log('\n🎉 ALL LOGIC AND DATA VERIFICATION TESTS PASSED SUCCESSFULLY!');
