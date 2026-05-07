
-- Switch increment_post_views to SECURITY INVOKER and grant minimal column update
DROP FUNCTION IF EXISTS public.increment_post_views(text);

CREATE OR REPLACE FUNCTION public.increment_post_views(post_slug text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.posts SET views = views + 1 WHERE slug = post_slug AND status = 'published';
$$;

-- Allow anon/authenticated to update only the views column on published posts
GRANT UPDATE (views) ON public.posts TO anon, authenticated;

-- RLS policy permitting update of views only
CREATE POLICY "Anyone can increment views"
ON public.posts FOR UPDATE
USING (status = 'published')
WITH CHECK (status = 'published');
