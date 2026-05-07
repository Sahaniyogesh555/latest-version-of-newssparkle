// Notifications dispatcher — scans posts and emits breaking + trending alerts
// Triggered by cron (every ~10 minutes). Idempotent: unique(slug,kind,alert_day).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREAKING_WINDOW_MIN = 30; // posts published within last 30 min
const TRENDING_WINDOW_HOURS = 6;
const TRENDING_MIN_VIEWS = 200; // threshold for trending alert

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results = { breaking: 0, trending: 0, errors: [] as string[] };

  try {
    // 1) BREAKING: recent published posts in breaking-news category, or any new post in last window
    const sinceBreaking = new Date(Date.now() - BREAKING_WINDOW_MIN * 60_000).toISOString();
    const { data: newPosts, error: e1 } = await supabase
      .from("posts")
      .select("id, slug, title, excerpt, featured_image_url, category_slug, published_at, views")
      .eq("status", "published")
      .gte("published_at", sinceBreaking)
      .order("published_at", { ascending: false })
      .limit(20);

    if (e1) throw e1;

    for (const p of newPosts ?? []) {
      const isBreaking = p.category_slug === "breaking-news";
      // Only emit "breaking" for breaking-news category; others get the trending pipeline.
      if (!isBreaking) continue;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("notifications").insert({
        post_id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        image_url: p.featured_image_url,
        category_slug: p.category_slug,
        kind: "breaking",
        reason: "new_post_breaking_category",
        views_at_alert: p.views ?? 0,
        alert_day: today,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      });
      if (!error) results.breaking++;
      else if (!error.message.includes("duplicate")) results.errors.push(error.message);
    }

    // 2) TRENDING: high-velocity posts in the last few hours
    const sinceTrending = new Date(Date.now() - TRENDING_WINDOW_HOURS * 3600_000).toISOString();
    const { data: trending, error: e2 } = await supabase
      .from("posts")
      .select("id, slug, title, excerpt, featured_image_url, category_slug, published_at, views")
      .eq("status", "published")
      .gte("published_at", sinceTrending)
      .gte("views", TRENDING_MIN_VIEWS)
      .order("views", { ascending: false })
      .limit(5);

    if (e2) throw e2;

    for (const p of trending ?? []) {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("notifications").insert({
        post_id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        image_url: p.featured_image_url,
        category_slug: p.category_slug,
        kind: "trending",
        reason: `views_${p.views}_in_${TRENDING_WINDOW_HOURS}h`,
        views_at_alert: p.views ?? 0,
        alert_day: today,
        expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(),
      });
      if (!error) results.trending++;
      else if (!error.message.includes("duplicate")) results.errors.push(error.message);
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String((err as Error).message ?? err), ...results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
