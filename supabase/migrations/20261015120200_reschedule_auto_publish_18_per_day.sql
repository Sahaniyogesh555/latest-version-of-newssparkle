-- ============================================================================
-- Fix the auto-publish schedule.
--
-- What was wrong with 20260503120747_10533559:
--   1. It pointed at project ref `gjmmnqtfvnjlwzqwzrzu`, while the front end
--      (.env), supabase/config.toml and every other migration use
--      `ruusbjlabbojpbawbphc`. The job was calling a different database.
--   2. It embedded a long-lived anon JWT in plain SQL. Treat that key as
--      compromised and rotate it (Supabase dashboard -> Settings -> API).
--   3. The function's payload `{"count":5}` is not read by auto-publish at all
--      (it reads category/slot/topic), so every run silently produced ONE
--      breaking-news/midday post: ~6 posts/day instead of the documented 18.
--
-- What this migration does: three daily slots x six categories = 18 posts/day,
-- with the shared secret stored in Supabase Vault instead of in source control.
-- ============================================================================

-- 0. Remove the old, misconfigured schedules.
DO $$
BEGIN
  PERFORM cron.unschedule('auto-publish-every-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-publish-morning');
  PERFORM cron.unschedule('auto-publish-midday');
  PERFORM cron.unschedule('auto-publish-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1. Store the automation secret in Vault (run once, outside this migration so
--    no secret is ever committed):
--
--      select vault.create_secret(
--        '<a long random string>',            -- openssl rand -hex 32
--        'auto_publish_secret',
--        'Shared secret for NewsSparkle automation endpoints'
--      );
--
--    Then set the same value on the functions:
--      supabase secrets set AUTO_PUBLISH_SECRET=<same value>
--
--    The jobs below read it at run time, so rotating the secret only requires
--    updating the Vault entry and the function secret.

CREATE OR REPLACE FUNCTION public.trigger_auto_publish(slot text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  secret text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
   WHERE name = 'auto_publish_secret';

  IF secret IS NULL THEN
    RAISE WARNING 'auto_publish_secret missing from Vault — auto-publish jobs will be rejected (401).';
  END IF;

  SELECT net.http_post(
    url := 'https://ruusbjlabbojpbawbphc.supabase.co/functions/v1/auto-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(secret, '')
    ),
    body := jsonb_build_object(
      'slot', slot,
      'categories', jsonb_build_array(
        'breaking-news', 'politics', 'business', 'technology', 'health', 'entertainment'
      )
    ),
    timeout_milliseconds := 150000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_auto_publish(text) FROM public;

-- 2. Three slots per day, UTC. 6 categories x 3 slots = 18 posts/day.
-- All five jobs in this file are publishing-capable or reader-facing, so they
-- are created INACTIVE. `db push` commits each file separately; until the Phase
-- 6 cron migration runs, the only safe state is "scheduled but not running".
SELECT cron.schedule_in_database('auto-publish-morning', '0 6 * * *',
  $$ SELECT public.trigger_auto_publish('morning'); $$, current_database(), active := false);
SELECT cron.schedule_in_database('auto-publish-midday', '0 12 * * *',
  $$ SELECT public.trigger_auto_publish('midday'); $$, current_database(), active := false);
SELECT cron.schedule_in_database('auto-publish-evening', '0 18 * * *',
  $$ SELECT public.trigger_auto_publish('evening'); $$, current_database(), active := false);

-- 3. Breaking-news monitor keeps its own cadence (it only publishes when a
--    genuinely new headline appears).
DO $$
BEGIN
  PERFORM cron.unschedule('breaking-news-monitor');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_breaking_news_monitor()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  secret text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
   WHERE name = 'auto_publish_secret';

  SELECT net.http_post(
    url := 'https://ruusbjlabbojpbawbphc.supabase.co/functions/v1/breaking-news-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(secret, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_breaking_news_monitor() FROM public;

SELECT cron.schedule_in_database('breaking-news-monitor', '*/30 * * * *',
  $$ SELECT public.trigger_breaking_news_monitor(); $$, current_database(), active := false);

-- 4. Notifications dispatcher every 10 minutes (it is idempotent per slug/kind/day).
DO $$
BEGIN
  PERFORM cron.unschedule('notifications-dispatcher');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_notifications_dispatcher()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  secret text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
   WHERE name = 'auto_publish_secret';

  SELECT net.http_post(
    url := 'https://ruusbjlabbojpbawbphc.supabase.co/functions/v1/notifications-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(secret, '')
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_notifications_dispatcher() FROM public;

SELECT cron.schedule_in_database('notifications-dispatcher', '*/10 * * * *',
  $$ SELECT public.trigger_notifications_dispatcher(); $$, current_database(), active := false);
