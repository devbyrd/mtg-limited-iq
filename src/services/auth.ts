import { supabase, isSupabaseConfigured } from './supabase';
import { UserAccount } from '../types/mtg';
import { User, Session } from '@supabase/supabase-js';

export type OAuthProvider = 'google' | 'discord' | 'apple' | 'github';

export interface AuthState {
  user: UserAccount | null;
  session: Session | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isLoading: boolean;
}

export function supabaseUserToUserAccount(user: User): UserAccount {
  const meta = user.user_metadata || {};
  const provider = (user.app_metadata?.provider as any) || 'email';
  const name =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    user.email?.split('@')[0] ||
    'Drafter';
  const avatarUrl = meta.avatar_url || meta.picture || undefined;

  let mappedProvider: UserAccount['provider'] = 'local';
  if (provider === 'google') mappedProvider = 'google';
  else if (provider === 'discord') mappedProvider = 'discord';
  else if (provider === 'apple') mappedProvider = 'apple';

  return {
    id: user.id,
    name,
    email: user.email,
    avatarUrl,
    avatarColor: provider === 'discord' ? '#5865F2' : provider === 'google' ? '#3b82f6' : '#8b5cf6',
    provider: mappedProvider,
    createdAt: user.created_at,
    lastLoginAt: new Date().toISOString(),
  };
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      error: new Error(
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      ),
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      error: new Error(
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      ),
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function signInWithPassword(email: string, password: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      user: null,
      error: new Error(
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      ),
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error: new Error(error.message) };
    if (!data.user) return { user: null, error: new Error('No user returned.') };

    return { user: supabaseUserToUserAccount(data.user), error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signUpWithPassword(email: string, password: string, displayName?: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      user: null,
      error: new Error(
        'Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      ),
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName?.trim() || email.split('@')[0],
        },
      },
    });
    if (error) return { user: null, error: new Error(error.message) };
    if (!data.user) return { user: null, error: new Error('No user returned.') };

    return { user: supabaseUserToUserAccount(data.user), error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signOut(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function getCurrentUser(): Promise<UserAccount | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? supabaseUserToUserAccount(user) : null;
  } catch (e) {
    return null;
  }
}

export async function updateUserProfile(displayName?: string, avatarUrl?: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) return { error: null };
  try {
    const updates: any = {};
    if (displayName) updates.full_name = displayName;
    if (avatarUrl) updates.avatar_url = avatarUrl;

    const { error: authErr } = await supabase.auth.updateUser({
      data: updates,
    });
    if (authErr) return { error: new Error(authErr.message) };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}
