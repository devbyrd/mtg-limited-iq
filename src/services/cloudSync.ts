import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfileStats, UserCardEvaluation, QuizResult } from '../types/mtg';
import { loadUserStats, saveUserStats, loadUserEvaluations } from './storage';
import { isCloudUUID } from './auth';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local_only' | 'error';

type SyncListener = (status: SyncStatus) => void;
const syncListeners: Set<SyncListener> = new Set();
let currentSyncStatus: SyncStatus = !isSupabaseConfigured()
  ? 'local_only'
  : typeof navigator !== 'undefined' && !navigator.onLine
  ? 'offline'
  : 'synced';

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

function setSyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  syncListeners.forEach((l) => l(status));
}

// ==================== REAL-TIME CONNECTIVITY LISTENER ====================

let pendingStatsSync: { userId: string; stats: UserProfileStats } | null = null;
let evalSyncQueue: Map<string, { userId: string; evaluation: UserCardEvaluation }> = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!isSupabaseConfigured()) {
      setSyncStatus('local_only');
      return;
    }
    setSyncStatus('synced');
    flushPendingSyncs();
  });

  window.addEventListener('offline', () => {
    setSyncStatus('offline');
  });
}

function flushPendingSyncs(): void {
  if (pendingStatsSync) {
    const { userId, stats } = pendingStatsSync;
    pendingStatsSync = null;
    queueStatsSync(userId, stats);
  }

  if (evalSyncQueue.size > 0) {
    const sampleItem = evalSyncQueue.values().next().value;
    if (sampleItem) {
      triggerEvaluationBatchSync(sampleItem.userId);
    }
  }
}

// ==================== DEBOUNCED SYNC ENGINE ====================

let statsSyncTimer: any = null;
let evalSyncTimer: any = null;

export function queueStatsSync(userId: string, stats: UserProfileStats): void {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    setSyncStatus('local_only');
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    pendingStatsSync = { userId, stats };
    setSyncStatus('offline');
    return;
  }

  setSyncStatus('syncing');
  if (statsSyncTimer) clearTimeout(statsSyncTimer);

  statsSyncTimer = setTimeout(async () => {
    try {
      const { error } = await supabase.from('user_stats').upsert(
        {
          user_id: userId,
          xp: stats.xp,
          level: stats.level,
          overall_accuracy: stats.overallAccuracy,
          stats_json: stats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.warn('Failed to sync stats to Supabase:', error);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
        pendingStatsSync = null;
      }
    } catch (e) {
      console.warn('Network error while syncing stats:', e);
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, 1500);
}

export function queueEvaluationSync(userId: string, evaluation: UserCardEvaluation): void {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    setSyncStatus('local_only');
    return;
  }

  const key = `${evaluation.setCode.toUpperCase()}_${evaluation.cardName.toLowerCase()}`;
  evalSyncQueue.set(key, { userId, evaluation });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline');
    return;
  }

  setSyncStatus('syncing');
  if (evalSyncTimer) clearTimeout(evalSyncTimer);

  evalSyncTimer = setTimeout(() => {
    triggerEvaluationBatchSync(userId);
  }, 1200);
}

async function triggerEvaluationBatchSync(userId: string): Promise<void> {
  const itemsToSync = Array.from(evalSyncQueue.values()).filter((item) => item.userId === userId);
  if (itemsToSync.length === 0) return;

  const batch = itemsToSync.map(({ evaluation }) => ({
    user_id: userId,
    set_code: evaluation.setCode.toUpperCase(),
    card_name: evaluation.cardName,
    evaluation_json: evaluation,
    updated_at: new Date().toISOString(),
  }));

  // Clear synced keys
  itemsToSync.forEach(({ evaluation }) => {
    const key = `${evaluation.setCode.toUpperCase()}_${evaluation.cardName.toLowerCase()}`;
    evalSyncQueue.delete(key);
  });

  try {
    const { error } = await supabase.from('card_evaluations').upsert(batch, {
      onConflict: 'user_id,set_code,card_name',
    });

    if (error) {
      console.warn('Failed to sync evaluations to Supabase:', error);
      setSyncStatus('error');
    } else {
      setSyncStatus('synced');
    }
  } catch (e) {
    console.warn('Network error while syncing evaluations:', e);
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  }
}

export async function queueEvaluationClearForSet(userId: string, setCode: string): Promise<void> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return;
  }
  try {
    const { error } = await supabase
      .from('card_evaluations')
      .delete()
      .eq('user_id', userId)
      .eq('set_code', setCode.toUpperCase());

    if (error) {
      console.warn('Failed to clear evaluations on Supabase:', error);
    }
  } catch (err) {
    console.warn('Error clearing evaluations on Supabase:', err);
  }
}

// ==================== PULL & MERGE ON LOGIN ====================

export async function pullRemoteUserData(userId: string): Promise<{
  stats: UserProfileStats | null;
  evaluations: Record<string, UserCardEvaluation>;
}> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return { stats: null, evaluations: {} };
  }

  setSyncStatus('syncing');

  try {
    // 1. Fetch Remote Stats
    const { data: statsRow } = await supabase
      .from('user_stats')
      .select('stats_json')
      .eq('user_id', userId)
      .maybeSingle();

    let remoteStats: UserProfileStats | null = null;
    if (statsRow?.stats_json && Object.keys(statsRow.stats_json).length > 0) {
      remoteStats = statsRow.stats_json as UserProfileStats;
      saveUserStats(remoteStats, userId);
    }

    // 2. Fetch Remote Evaluations
    const { data: evalRows } = await supabase
      .from('card_evaluations')
      .select('set_code, card_name, evaluation_json')
      .eq('user_id', userId);

    const remoteEvals: Record<string, UserCardEvaluation> = {};
    if (evalRows && evalRows.length > 0) {
      evalRows.forEach((row) => {
        const key = `${row.set_code.toLowerCase()}_${row.card_name.toLowerCase()}`;
        remoteEvals[key] = row.evaluation_json as UserCardEvaluation;
      });
      localStorage.setItem(`mtg_evaluations_${userId}`, JSON.stringify(remoteEvals));
    }

    setSyncStatus('synced');
    return { stats: remoteStats, evaluations: remoteEvals };
  } catch (err) {
    console.error('Failed to pull remote data from Supabase:', err);
    setSyncStatus('error');
    return { stats: null, evaluations: {} };
  }
}

export async function migrateLocalDataToCloud(
  cloudUserId: string,
  localGuestId: string = 'user_default'
): Promise<void> {
  if (!isSupabaseConfigured() || !isCloudUUID(cloudUserId)) {
    return;
  }

  try {
    setSyncStatus('syncing');

    // 1. Merge & Upload Stats
    const localStats = loadUserStats(localGuestId);
    if (localStats.totalQuestions > 0 || localStats.xp > 0) {
      // Pull current remote stats to merge intelligently
      const { data: remoteRow } = await supabase
        .from('user_stats')
        .select('stats_json')
        .eq('user_id', cloudUserId)
        .maybeSingle();

      const remoteStats = (remoteRow?.stats_json as UserProfileStats) || null;

      const mergedStats: UserProfileStats = remoteStats
        ? {
            ...remoteStats,
            xp: Math.max(remoteStats.xp, localStats.xp),
            level: Math.max(remoteStats.level, localStats.level),
            totalQuizzes: Math.max(remoteStats.totalQuizzes, localStats.totalQuizzes),
            totalQuestions: Math.max(remoteStats.totalQuestions, localStats.totalQuestions),
            totalCorrect: Math.max(remoteStats.totalCorrect, localStats.totalCorrect),
            bestStreak: Math.max(remoteStats.bestStreak, localStats.bestStreak),
            currentStreak: localStats.currentStreak || remoteStats.currentStreak,
            overallAccuracy: Math.max(remoteStats.overallAccuracy, localStats.overallAccuracy),
            missedCards: { ...localStats.missedCards, ...remoteStats.missedCards },
            sets: { ...localStats.sets, ...remoteStats.sets },
            recentQuizzes: [
              ...(remoteStats.recentQuizzes || []),
              ...(localStats.recentQuizzes || []),
            ].slice(0, 20),
            lastActive: new Date().toISOString(),
          }
        : localStats;

      await supabase.from('user_stats').upsert(
        {
          user_id: cloudUserId,
          xp: mergedStats.xp,
          level: mergedStats.level,
          overall_accuracy: mergedStats.overallAccuracy,
          stats_json: mergedStats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      saveUserStats(mergedStats, cloudUserId);
    }

    // 2. Merge & Upload Evaluations
    const localEvals = loadUserEvaluations(localGuestId);
    const localEvalEntries = Object.values(localEvals);

    if (localEvalEntries.length > 0) {
      const batch = localEvalEntries.map((ev) => ({
        user_id: cloudUserId,
        set_code: ev.setCode.toUpperCase(),
        card_name: ev.cardName,
        evaluation_json: ev,
        updated_at: ev.updatedAt || new Date().toISOString(),
      }));

      await supabase.from('card_evaluations').upsert(batch, {
        onConflict: 'user_id,set_code,card_name',
      });

      // Save locally under cloud user ID
      const existingCloudEvals = loadUserEvaluations(cloudUserId);
      const mergedEvals = { ...existingCloudEvals, ...localEvals };
      localStorage.setItem(`mtg_evaluations_${cloudUserId}`, JSON.stringify(mergedEvals));
    }

    setSyncStatus('synced');
  } catch (err) {
    console.warn('Migration to Supabase encountered an error:', err);
    setSyncStatus('error');
  }
}
