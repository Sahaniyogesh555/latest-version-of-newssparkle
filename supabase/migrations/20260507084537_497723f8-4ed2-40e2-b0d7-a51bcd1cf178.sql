
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  image_url text,
  category_slug text,
  kind text NOT NULL CHECK (kind IN ('breaking','trending')),
  reason text,
  views_at_alert integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  alert_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date
);

CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_kind_expires ON public.notifications (kind, expires_at);
CREATE UNIQUE INDEX idx_notifications_unique_kind_slug_day
  ON public.notifications (slug, kind, alert_day);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active notifications"
  ON public.notifications
  FOR SELECT
  USING (expires_at > now());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
