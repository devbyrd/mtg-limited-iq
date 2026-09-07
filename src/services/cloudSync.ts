import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfileStats, UserCardEvaluation, QuizResult } from '../types/mtg';
import { loadUserStats, saveUserStats, loadUserEvaluations, saveUserEvaluation } from './storage';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local_only' | 'error';

type SyncListener = (status: SyncStatus) => void;
const syncListeners: Set<SyncListener> = new Set();
let currentSyncStatus: SyncStatus = isSupabaseConfigured() ? 'synced' : 'local_only';

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

// ==================== DEBOUNCED SYNC ENGINE ====================

let statsSyncTimer: any = null;
let evalSyncQueue: Map<string, UserCardEvaluation> = new Map();
let evalSyncTimer: any = null;

export function queueStatsSync(userId: string, stats: UserProfileStats): void {
  if (!isSupabaseConfigured() || !userId || userId.startsWith('usr_')) {
    setSyncStatus('local_only');
    return;
  }

  if (!navigator.onLine) {
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
      }
    } catch (e) {
      console.warn('Network error while syncing stats:', e);
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, 1500);
}

export function queueEvaluationSync(userId: string, evaluation: UserCardEvaluation): void {
  if (!isSupabaseConfigured() || !userId || userId.startsWith('usr_')) {
    setSyncStatus('local_only');
    return;
  }

  const key = `${evaluation.setCode.toUpperCase()}_${evaluation.cardName}`;
  evalSyncQueue.set(key, evaluation);

  if (!navigator.onLine) {
    setSyncStatus('offline');
    return;
  }

  setSyncStatus('syncing');
  if (evalSyncTimer) clearTimeout(evalSyncTimer);

  evalSyncTimer = setTimeout(async () => {
    const batch = Array.from(evalSyncQueue.values()).map((item) => ({
      user_id: userId,
      set_code: item.setCode.toUpperCase(),
      card_name: item.cardName,
      evaluation_json: item,
      updated_at: new Date().toISOString(),
    }));
    evalSyncQueue.clear();

    if (batch.length === 0) return;

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
  }, 1200);
}

export async function queueEvaluationClearForSet(userId: string, setCode: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId || userId.startsWith('usr_')) {
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
  if (!isSupabaseConfigured() || !userId || userId.startsWith('usr_')) {
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

export async function migrateLocalDataToCloud(cloudUserId: string, localGuestId: string = 'user_default'): Promise<void> {
  if (!isSupabaseConfigured() || !cloudUserId || cloudUserId.startsWith('usr_')) {
    return;
  }

  try {
    setSyncStatus('syncing');

    // 1. Check local stats
    const localStats = loadUserStats(localGuestId);
    if (localStats.totalQuestions > 0) {
      await supabase.from('user_stats').upsert(
        {
          user_id: cloudUserId,
          xp: localStats.xp,
          level: localStats.level,
          overall_accuracy: localStats.overallAccuracy,
          stats_json: localStats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      saveUserStats(localStats, cloudUserId);
    }

    // 2. Check local evaluations
    const localEvals = loadUserEvaluations(localGuestId);
    const evalEntries = Object.values(localEvals);
    if (evalEntries.length > 0) {
      const batch = evalEntries.map((ev) => ({
        user_id: cloudUserId,
        set_code: ev.setCode.toUpperCase(),
        card_name: ev.cardName,
        evaluation_json: ev,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('card_evaluations').upsert(batch, {
        onConflict: 'user_id,set_code,card_name',
      });
      localStorage.setItem(`mtg_evaluations_${cloudUserId}`, JSON.stringify(localEvals));
    }

    setSyncStatus('synced');
  } catch (err) {
    console.warn('Migration to Supabase encountered an error:', err);
    setSyncStatus('error');
  }
}
