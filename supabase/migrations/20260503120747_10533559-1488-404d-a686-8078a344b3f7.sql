
-- Remove existing schedule if re-running
DO $$ BEGIN
  PERFORM cron.unschedule('auto-publish-every-4h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-publish-every-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gjmmnqtfvnjlwzqwzrzu.supabase.co/functions/v1/auto-publish',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqbW1ucXRmdm5qbHd6cXd6cnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTg3MDMsImV4cCI6MjA5MzM3NDcwM30.dVEkOsUxEfkNKkUTYIxSyvGw3zf4Nrjr8wEmikM0l9U"}'::jsonb,
    body := '{"count":5}'::jsonb
  ) AS request_id;
  $$
);
