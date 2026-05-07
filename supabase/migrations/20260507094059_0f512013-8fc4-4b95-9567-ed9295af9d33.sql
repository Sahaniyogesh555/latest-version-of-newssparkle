CREATE TABLE IF NOT EXISTS public.feed_validation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_errors int not null default 0,
  total_warnings int not null default 0,
  report jsonb not null default '[]'::jsonb
);
ALTER TABLE public.feed_validation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read feed validation runs"
  ON public.feed_validation_runs FOR SELECT TO public USING (true);