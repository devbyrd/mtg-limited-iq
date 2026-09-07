-- ==============================================================================
-- MTG LIMITED IQ: SUPABASE PRODUCTION DATABASE SCHEMA & ROW-LEVEL SECURITY (RLS)
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 2. USER STATS TABLE
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0 NOT NULL,
  level INT DEFAULT 1 NOT NULL,
  overall_accuracy INT DEFAULT 0 NOT NULL,
  stats_json JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- User Stats Policies
CREATE POLICY "Users can view their own stats" 
  ON public.user_stats FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" 
  ON public.user_stats FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" 
  ON public.user_stats FOR UPDATE 
  USING (auth.uid() = user_id);

-- 3. CARD EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS public.card_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_code TEXT NOT NULL,
  card_name TEXT NOT NULL,
  evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_set_card UNIQUE(user_id, set_code, card_name)
);

-- Index for fast lookup by user and set
CREATE INDEX IF NOT EXISTS idx_card_evaluations_user_set 
  ON public.card_evaluations(user_id, set_code);

-- Enable RLS on card_evaluations
ALTER TABLE public.card_evaluations ENABLE ROW LEVEL SECURITY;

-- Card Evaluations Policies
CREATE POLICY "Users can view their own evaluations" 
  ON public.card_evaluations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evaluations" 
  ON public.card_evaluations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evaluations" 
  ON public.card_evaluations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations" 
  ON public.card_evaluations FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. AUTOMATIC NEW USER INITIALIZATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1),
      'Drafter'
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      NULL
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert default user_stats
  INSERT INTO public.user_stats (user_id, xp, level, overall_accuracy, stats_json)
  VALUES (new.id, 0, 1, 0, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute upon auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
