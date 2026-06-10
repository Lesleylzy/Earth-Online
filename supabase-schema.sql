-- ═══ EARTH ONLINE — Database Schema ═══
-- Run this in Supabase SQL Editor

-- Public tasks (admin-maintained)
CREATE TABLE public_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_en text NOT NULL,
  content_cn text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- User custom tasks (private)
CREATE TABLE custom_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Public task completions
CREATE TABLE public_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public_tasks(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Custom task completions
CREATE TABLE custom_completions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES custom_tasks(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Public task skips
CREATE TABLE public_skips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public_tasks(id) ON DELETE CASCADE,
  skipped_at timestamptz DEFAULT now()
);

-- Custom task skips
CREATE TABLE custom_skips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES custom_tasks(id) ON DELETE CASCADE,
  skipped_at timestamptz DEFAULT now()
);

-- Daily ratings (user's rating of their Earth Online experience per day)
CREATE TABLE daily_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Pending task suggestions
CREATE TABLE pending_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  description text,
  submitted_language text CHECK (submitted_language IN ('en','cn')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- ═══ ROW LEVEL SECURITY ═══
-- IMPORTANT: Replace '2799786996@qq.com' with your actual admin email

-- public_tasks: anyone can read, only admin can write
ALTER TABLE public_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public tasks" ON public_tasks FOR SELECT USING (true);
CREATE POLICY "Only admin can insert public_tasks" ON public_tasks FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = '2799786996@qq.com');
CREATE POLICY "Only admin can update public_tasks" ON public_tasks FOR UPDATE
  USING (auth.jwt() ->> 'email' = '2799786996@qq.com');
CREATE POLICY "Only admin can delete public_tasks" ON public_tasks FOR DELETE
  USING (auth.jwt() ->> 'email' = '2799786996@qq.com');

-- custom_tasks: users own their data
ALTER TABLE custom_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own custom tasks" ON custom_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own custom tasks" ON custom_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own custom tasks" ON custom_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own custom tasks" ON custom_tasks FOR DELETE USING (auth.uid() = user_id);

-- public_completions
ALTER TABLE public_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own public completions" ON public_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own public completions" ON public_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own public completions" ON public_completions FOR DELETE USING (auth.uid() = user_id);

-- custom_completions
ALTER TABLE custom_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own custom completions" ON custom_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own custom completions" ON custom_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own custom completions" ON custom_completions FOR DELETE USING (auth.uid() = user_id);

-- public_skips
ALTER TABLE public_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own public skips" ON public_skips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own public skips" ON public_skips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own public skips" ON public_skips FOR DELETE USING (auth.uid() = user_id);

-- custom_skips
ALTER TABLE custom_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own custom skips" ON custom_skips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own custom skips" ON custom_skips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own custom skips" ON custom_skips FOR DELETE USING (auth.uid() = user_id);

-- daily_ratings: users own their ratings
ALTER TABLE daily_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own daily ratings" ON daily_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own daily ratings" ON daily_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own daily ratings" ON daily_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own daily ratings" ON daily_ratings FOR DELETE USING (auth.uid() = user_id);

-- pending_tasks: anyone can submit, only admin can read/update
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit pending tasks" ON pending_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admin can read pending tasks" ON pending_tasks FOR SELECT
  USING (auth.jwt() ->> 'email' = '2799786996@qq.com');
CREATE POLICY "Only admin can update pending tasks" ON pending_tasks FOR UPDATE
  USING (auth.jwt() ->> 'email' = '2799786996@qq.com');
