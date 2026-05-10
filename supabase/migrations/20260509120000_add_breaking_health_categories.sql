-- Add missing categories required by NewsSparkle scheduling and site category list.
INSERT INTO public.categories (name, slug, description, color)
VALUES
  ('Breaking News', 'breaking-news', 'Real-time alerts, major developments, and urgent stories across the world.', '#ef4444'),
  ('Health & Lifestyle', 'health', 'Medical updates, wellness trends, and lifestyle reporting with credible sources.', '#059669')
ON CONFLICT (slug) DO NOTHING;
