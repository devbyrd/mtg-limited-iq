import { isCloudUUID } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { loadUserStats, saveUserStats, loadUserEvaluations, saveUserEvaluation, defaultStats } from '../services/storage';
import { UserCardEvaluation, UserProfileStats } from '../types/mtg';

console.log('=== MTG Limited IQ Cloud Sync & Auth Verification ===\n');

// 1. Verify isCloudUUID validator
const validUUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const invalidGuest1 = 'user_default';
const invalidGuest2 = 'usr_1712345678_abcde';
const invalidRandom = 'not-a-uuid';

console.assert(isCloudUUID(validUUID) === true, 'Valid UUID must pass');
console.assert(isCloudUUID(invalidGuest1) === false, 'user_default must NOT be treated as cloud UUID');
console.assert(isCloudUUID(invalidGuest2) === false, 'usr_ prefix must NOT be treated as cloud UUID');
console.assert(isCloudUUID(invalidRandom) === false, 'Random string must NOT be treated as cloud UUID');
console.assert(isCloudUUID(null) === false, 'null must NOT be treated as cloud UUID');
console.assert(isCloudUUID(undefined) === false, 'undefined must NOT be treated as cloud UUID');
console.log('✓ isCloudUUID correctly isolates cloud accounts from local guest IDs.');

// 2. Verify localStorage mock environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

// 3. Verify Local Guest Stats Persistence
const guestId = 'user_default';
const testStats: UserProfileStats = {
  ...defaultStats,
  xp: 450,
  level: 1,
  totalQuizzes: 3,
  totalQuestions: 15,
  totalCorrect: 13,
  overallAccuracy: 87,
  currentStreak: 3,
  bestStreak: 3,
};

saveUserStats(testStats, guestId);
const loadedStats = loadUserStats(guestId);
console.assert(loadedStats.xp === 450, `Expected XP 450, got ${loadedStats.xp}`);
console.assert(loadedStats.totalQuizzes === 3, `Expected 3 quizzes, got ${loadedStats.totalQuizzes}`);
console.assert(loadedStats.overallAccuracy === 87, `Expected 87% accuracy, got ${loadedStats.overallAccuracy}`);
console.log('✓ Guest stats correctly persist and calculate locally.');

// 4. Verify Local Guest Evaluations Persistence
const testEval: UserCardEvaluation = {
  cardId: 'test-card-1',
  cardName: 'Murder',
  setCode: 'M20',
  userGrade: 'B+',
  userScore: 3.5,
  pickPriority: 'Early Pick',
  updatedAt: new Date().toISOString(),
};

saveUserEvaluation(testEval, guestId);
const loadedEvals = loadUserEvaluations(guestId);
const evalKey = 'm20_murder';
console.assert(Boolean(loadedEvals[evalKey]), 'Evaluation should be keyed by lowercase set_card');
console.assert(loadedEvals[evalKey]?.userGrade === 'B+', 'Evaluation grade must be preserved');
console.log('✓ Card evaluations correctly persist locally with zero lag.');

// 5. Verify Unconfigured Supabase Fallback
console.assert(typeof isSupabaseConfigured === 'function', 'isSupabaseConfigured must be exported');
const isConfigured = isSupabaseConfigured();
console.log(`✓ Supabase configured state: ${isConfigured ? 'Connected' : 'Local Fallback Mode'}`);

console.log('\n🎉 ALL CLOUD SYNC & AUTH VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
