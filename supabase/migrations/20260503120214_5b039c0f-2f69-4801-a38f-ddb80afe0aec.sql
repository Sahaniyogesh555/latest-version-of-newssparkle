
-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL,
  content text NOT NULL,
  meta_title text NOT NULL,
  meta_description text NOT NULL,
  keywords text[] DEFAULT '{}',
  featured_image_url text,
  featured_image_alt text,
  category_slug text NOT NULL REFERENCES public.categories(slug) ON DELETE RESTRICT,
  author text NOT NULL DEFAULT 'Editorial Desk',
  status text NOT NULL DEFAULT 'published',
  reading_minutes int DEFAULT 5,
  views int NOT NULL DEFAULT 0,
  faq jsonb DEFAULT '[]'::jsonb,
  key_takeaways text[] DEFAULT '{}',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_category ON public.posts(category_slug);
CREATE INDEX idx_posts_published ON public.posts(published_at DESC) WHERE status = 'published';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read published posts" ON public.posts FOR SELECT USING (status = 'published');

-- Increment views helper
CREATE OR REPLACE FUNCTION public.increment_post_views(post_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.posts SET views = views + 1 WHERE slug = post_slug;
$$;

-- Least privilege, applied at creation time. Supabase's default privileges
-- grant EXECUTE on every new function in public to anon, authenticated and
-- service_role, so `revoke ... from public` alone leaves those per-role grants
-- in place. The view counter is the only function the public may call.
REVOKE ALL ON FUNCTION public.increment_post_views(text) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_post_views(text) TO anon, authenticated, service_role;

-- Trigger helper: not a callable RPC for any API role.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated, service_role;

-- Seed 6 categories
INSERT INTO public.categories (name, slug, description, color) VALUES
('World', 'world', 'Global affairs, geopolitics, diplomacy and international events.', '#dc2626'),
('Politics', 'politics', 'Elections, policy, governance and political analysis worldwide.', '#2563eb'),
('Business', 'business', 'Markets, economy, corporate news and the global financial pulse.', '#059669'),
('Technology', 'technology', 'AI, cybersecurity, gadgets and the companies shaping tomorrow.', '#7c3aed'),
('Sports', 'sports', 'Match reports, transfers and analysis from every major league.', '#ea580c'),
('Entertainment', 'entertainment', 'Film, music, streaming, celebrity culture and pop trends.', '#db2777');

-- Schedule cron (auto-publisher every 4 hours) — extensions enabled here.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
