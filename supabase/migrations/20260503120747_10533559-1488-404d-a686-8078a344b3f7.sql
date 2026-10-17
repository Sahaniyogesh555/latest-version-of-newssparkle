
-- Remove existing schedule if re-running
DO $$ BEGIN
  PERFORM cron.unschedule('auto-publish-every-4h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Created INACTIVE. This is the first migration in the chain and it is not
-- fail-closed on its own: `db push` applies files one at a time, so whatever
-- this file creates is live before the later migrations run. A job that posts
-- to another project must therefore never be born active. The Phase 6 cron
-- migration removes this name from the schedule anyway.
SELECT cron.schedule_in_database(
  'auto-publish-every-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gjmmnqtfvnjlwzqwzrzu.supabase.co/functions/v1/auto-publish',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqbW1ucXRmdm5qbHd6cXd6cnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTg3MDMsImV4cCI6MjA5MzM3NDcwM30.dVEkOsUxEfkNKkUTYIxSyvGw3zf4Nrjr8wEmikM0l9U"}'::jsonb,
    body := '{"count":5}'::jsonb
  ) AS request_id;
  $$,
  current_database(),
  active := false
);
