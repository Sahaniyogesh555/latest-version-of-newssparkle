import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { CATEGORIES, SITE } from "@/lib/site";
import { Link } from "react-router-dom";
import { BreakingTicker } from "@/components/home/BreakingTicker";
import { HeroGrid } from "@/components/home/HeroGrid";
import { TrendingStrip } from "@/components/home/TrendingStrip";
import { CategoryBlock } from "@/components/home/CategoryBlock";
import { EditorsPicks } from "@/components/home/EditorsPicks";
import { LatestFeed } from "@/components/home/LatestFeed";

export default function Index() {
  const [latest, setLatest] = useState<Post[]>([]);
  const [trending, setTrending] = useState<Post[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Post[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [latestRes, trendingRes, ...catRes] = await Promise.all([
        supabase.from("posts").select("*").eq("status", "published")
          .order("published_at", { ascending: false }).limit(30),
        supabase.from("posts").select("*").eq("status", "published")
          .order("views", { ascending: false }).limit(5),
        ...CATEGORIES.map(c =>
          supabase.from("posts").select("*").eq("status", "published").eq("category_slug", c.slug)
            .order("published_at", { ascending: false }).limit(5)
        ),
      ]);
      setLatest((latestRes.data as Post[]) || []);
      setTrending((trendingRes.data as Post[]) || []);
      const m: Record<string, Post[]> = {};
      CATEGORIES.forEach((c, i) => { m[c.slug] = (catRes[i].data as Post[]) || []; });
      setByCategory(m);
      setLoading(false);
    })();
  }, []);

  const breakingPosts = useMemo(
    () => latest.filter(p => p.category_slug === "breaking-news").slice(0, 8),
    [latest]
  );
  const heroPosts = latest.slice(0, 6);
  const heroIds = useMemo(() => new Set(heroPosts.map(p => p.id)), [heroPosts]);
  const editorsPicks = useMemo(
    () => latest.filter(p => !heroIds.has(p.id)).slice(0, 4),
    [latest, heroIds]
  );
  const editorIds = useMemo(() => new Set(editorsPicks.map(p => p.id)), [editorsPicks]);
  const excludeFromFeed = useMemo(() => new Set([...heroIds, ...editorIds]), [heroIds, editorIds]);
  const feedSeed = useMemo(
    () => latest.filter(p => !excludeFromFeed.has(p.id)).slice(0, 9),
    [latest, excludeFromFeed]
  );

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of latest) for (const k of (p.keywords || [])) {
      const tag = k.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  }, [latest]);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: SITE.tagline,
    url: SITE.url,
    description: SITE.description,
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` } },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  if (loading) {
    return (
      <Layout>
        <SEO title={`${SITE.name} — ${SITE.tagline}`} description={SITE.description} path="/" jsonLd={websiteLd} />
        <div className="container-wide py-16 animate-pulse space-y-6">
          <div className="h-10 bg-muted w-1/3 rounded" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 aspect-video bg-muted rounded" />
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded" />
              <div className="aspect-video bg-muted rounded" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title={`${SITE.name} — ${SITE.tagline}`} description={SITE.description} path="/" jsonLd={websiteLd} />

      <BreakingTicker posts={breakingPosts.length ? breakingPosts : latest.slice(0, 6)} />
      <HeroGrid posts={heroPosts} />
      <TrendingStrip posts={trending} />

      {/* Category blocks */}
      <div className="divide-y divide-border">
        {CATEGORIES.map(c => (
          <CategoryBlock key={c.slug} slug={c.slug} posts={byCategory[c.slug] || []} />
        ))}
      </div>

      <EditorsPicks posts={editorsPicks} />

      <LatestFeed initial={feedSeed} excludeIds={excludeFromFeed} />

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <section className="border-y border-border bg-muted/40">
          <div className="container-wide py-12">
            <div className="kicker text-primary mb-3">Trending Topics</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-headline mb-6">
              What people are reading about
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {trendingTags.map(tag => (
                <Link key={tag} to={`/tag/${encodeURIComponent(tag)}`}
                  className="px-3.5 py-1.5 text-sm bg-background border border-border text-foreground/80 hover:border-primary hover:text-primary transition-colors">
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="container-wide py-16 sm:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="kicker text-primary mb-3">The Daily Brief</div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-headline leading-[1.1]">
            One email. <em className="text-primary not-italic italic font-serif">Every morning.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-foreground/70 leading-relaxed">
            The stories that matter, edited for the busy. Delivered before your first coffee.
          </p>
          <form onSubmit={e => e.preventDefault()} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" required placeholder="you@example.com"
              className="flex-1 px-4 py-3 bg-background border border-border focus:border-primary focus:outline-none text-base" />
            <button type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold text-[15px] tracking-wide hover:bg-primary/90 transition-colors">
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-xs text-byline uppercase tracking-wider">Free · Unsubscribe anytime</p>
        </div>
      </section>
    </Layout>
  );
}
