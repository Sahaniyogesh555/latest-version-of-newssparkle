import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { SEO } from "@/components/SEO";
import { CATEGORIES, SITE, formatDate } from "@/lib/site";
import { BreakingNewsTicker } from "@/components/BreakingNewsTicker";
import { HeroFeaturedGrid } from "@/components/HeroFeaturedGrid";
import { TrendingSection } from "@/components/TrendingSection";
import { CategoryBlock } from "@/components/CategoryBlock";
import { EditorsPicksSection } from "@/components/EditorsPicksSection";
import { ContinueReading } from "@/components/ContinueReading";
import { Link } from "react-router-dom";
import { Mail, Heart } from "lucide-react";

const PAGE_SIZE = 15;

export default function Index() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [categoryPosts, setCategoryPosts] = useState<Record<string, Post[]>>({});

  useEffect(() => {
    const initialize = async () => {
      // Fetch main feed
      const { data: mainPosts } = await supabase
        .from("posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(0, PAGE_SIZE);

      const postList = (mainPosts as Post[]) || [];
      setPosts(postList);
      setHasMore(postList.length === PAGE_SIZE + 1);
      setLoading(false);

      // Fetch posts for each category (for category blocks)
      const categoryData: Record<string, Post[]> = {};
      for (const cat of CATEGORIES) {
        const { data } = await supabase
          .from("posts")
          .select("*")
          .eq("category_slug", cat.slug)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(4);
        if (data) {
          categoryData[cat.slug] = (data as Post[]) || [];
        }
      }
      setCategoryPosts(categoryData);
    };

    initialize();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const from = posts.length;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, to);
    const next = (data as Post[]) || [];
    setPosts((prev) => [...prev, ...next]);
    setHasMore(next.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [posts.length, loadingMore, hasMore]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "800px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore, hasMore, loading]);

  const hero = posts[0];
  const secondary = posts.slice(1, 4);
  const editorsPicks = posts.filter((_, i) => i % 3 === 0).slice(0, 6);
  const trending = posts.slice(0, 12).sort((a, b) => (b.views || 0) - (a.views || 0));
  const latest = posts.slice(4);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts.slice(0, 50)) {
      for (const k of p.keywords || []) {
        const tag = k.trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);
  }, [posts]);

  const todayLabel = formatDate(new Date().toISOString()).toUpperCase();

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: SITE.tagline,
    url: SITE.url,
    description: SITE.description,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/?s={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Layout>
      <SEO
        title={`${SITE.name} — ${SITE.tagline}`}
        description={SITE.description}
        path="/"
        jsonLd={websiteLd}
      />

      {/* Breaking News Ticker */}
      <BreakingNewsTicker />

      {/* Hero Masthead */}
      <section className="container-wide pt-12 sm:pt-16 pb-6">
        <div className="rounded-[2rem] border border-border bg-card/90 shadow-card p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-primary font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" /> LIVE NEWS
              </div>
              <div className="mt-6 flex flex-col gap-6">
                <div>
                  <span className="kicker text-primary">{todayLabel}</span>
                  <h1 className="headline-hero max-w-3xl mt-4">
                    {SITE.name} delivers premium journalism for fast-moving readers.
                  </h1>
                </div>
                <p className="text-lg text-foreground/75 leading-relaxed max-w-2xl">
                  {SITE.description} Search-friendly coverage, expert analysis, and newsroom accountability for readers who demand clarity without noise.
                </p>
                <div className="grid gap-3 sm:grid-cols-3 mt-6">
                  <div className="rounded-3xl border border-border p-4 bg-background/90 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.28em] text-byline">Verified reporting</p>
                    <p className="mt-2 font-semibold text-headline">Editorial fact checks</p>
                  </div>
                  <div className="rounded-3xl border border-border p-4 bg-background/90 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.28em] text-byline">Trusted reach</p>
                    <p className="mt-2 font-semibold text-headline">High authority coverage</p>
                  </div>
                  <div className="rounded-3xl border border-border p-4 bg-background/90 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.28em] text-byline">Mobile-ready</p>
                    <p className="mt-2 font-semibold text-headline">Fast, thumb-friendly layout</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 min-w-[280px] lg:max-w-xs">
              <div className="rounded-3xl border border-border bg-secondary/10 p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span className="kicker text-primary uppercase">Top story</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-primary font-semibold">Editor’s pick</span>
                </div>
                {hero ? (
                  <Link to={`/post/${hero.slug}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
                      <img
                        src={hero.featured_image_url}
                        alt={hero.featured_image_alt || hero.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="eager"
                      />
                    </div>
                    <h2 className="mt-4 font-serif text-2xl font-black leading-tight text-headline group-hover:text-primary transition-colors">
                      {hero.title}
                    </h2>
                    <p className="mt-3 text-sm text-foreground/70 leading-relaxed line-clamp-3">
                      {hero.excerpt}
                    </p>
                  </Link>
                ) : (
                  <div className="h-56 rounded-3xl bg-muted animate-pulse" />
                )}
              </div>
              <div className="rounded-3xl border border-border bg-background/95 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="kicker text-primary uppercase">Trending topics</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-byline">Now</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trendingTags.slice(0, 7).map((tag) => (
                    <Link
                      key={tag}
                      to={`/tag/${encodeURIComponent(tag)}`}
                      className="rounded-full border border-border px-3 py-2 text-xs text-foreground/80 hover:border-primary hover:text-primary transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured hero grid */}
      {!loading && hero && (
        <HeroFeaturedGrid featured={hero} secondary={secondary} />
      )}

      {/* Continue reading */}
      <div className="container-wide py-8">
        <ContinueReading />
      </div>

      {/* Trending section */}
      {trending.length > 0 && <TrendingSection posts={trending} />}

      {/* Category blocks */}
      {Object.entries(categoryPosts).map(([slug, posts]) =>
        posts.length > 0 ? (
          <CategoryBlock key={slug} categorySlug={slug} posts={posts} />
        ) : null
      )}

      {/* Editor's Picks */}
      {editorsPicks.length > 0 && <EditorsPicksSection posts={editorsPicks} />}

      {/* Latest News Feed */}
      {latest.length > 0 && (
        <section className="container-wide py-12 sm:py-16" aria-live="polite">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10 pb-4 border-b border-rule">
            <div>
              <h2 className="headline-lg">Latest Stories</h2>
              <p className="text-sm text-foreground/70 mt-2 max-w-2xl">
                Fresh coverage updated throughout the day, with fast access to the newest stories and verified context.
              </p>
            </div>
            <span className="kicker text-byline hidden sm:inline">
              Updated continuously
            </span>
          </div>

          {loading ? (
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-muted rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {latest.slice(0, PAGE_SIZE).map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
              <div ref={sentinelRef} aria-hidden className="h-10 mt-10" />
              <div className="mt-10 flex flex-col items-center gap-4">
                {hasMore && !loadingMore ? (
                  <button
                    onClick={loadMore}
                    className="inline-flex items-center justify-center rounded-full border border-primary bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Load more stories
                  </button>
                ) : null}
                {loadingMore && (
                  <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse w-full">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-80 bg-muted rounded-lg" />
                    ))}
                  </div>
                )}
                {!hasMore && latest.length > 0 && (
                  <p className="text-center text-byline text-sm uppercase tracking-wider mt-4">
                    — You’ve reached the latest coverage —
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <section className="border-y border-rule bg-muted/40">
          <div className="container-wide py-12 sm:py-16">
            <div className="kicker text-primary mb-4">POPULAR TOPICS</div>
            <h2 className="headline-lg mb-8">What people are reading about</h2>
            <div className="flex flex-wrap gap-3">
              {trendingTags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tag/${encodeURIComponent(tag)}`}
                  className="px-4 py-2 text-sm bg-card border border-border text-foreground/80 hover:border-primary hover:text-primary hover:bg-card/80 transition-all rounded-lg"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter CTA Section */}
      <section className="container-wide py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          <div className="card-base p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <Mail className="size-8 text-primary" />
              </div>
            </div>
            <div className="kicker text-primary mb-3">STAY INFORMED</div>
            <h2 className="headline-lg mb-4">
              Get the news that matters, every morning.
            </h2>
            <p className="text-lg text-foreground/70 leading-relaxed mb-8">
              The stories you need to know, fact-checked, and edited for clarity. One email.
              Every day. Free.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="flex-1 px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
              />
              <button
                type="submit"
                className="btn-primary px-6 py-3 whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-4 text-xs text-byline uppercase tracking-wider">
              Unsubscribe anytime. Privacy guaranteed.
            </p>
          </div>
        </div>
      </section>

      {/* Trust signals footer section */}
      <section className="border-t border-border">
        <div className="container-wide py-12">
          <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <h3 className="font-serif font-bold text-headline mb-3">Editorial</h3>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <Link
                    to="/editorial-policy"
                    className="hover:text-primary transition-colors"
                  >
                    Editorial Policy
                  </Link>
                </li>
                <li>
                  <Link to="/corrections" className="hover:text-primary transition-colors">
                    Corrections
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-primary transition-colors">
                    Submit a Tip
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif font-bold text-headline mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <Link to="/terms" className="hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/disclaimer" className="hover:text-primary transition-colors">
                    Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif font-bold text-headline mb-3">About</h3>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <Link to="/about" className="hover:text-primary transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/authors" className="hover:text-primary transition-colors">
                    Our Team
                  </Link>
                </li>
                <li>
                  <Link to="/brand" className="hover:text-primary transition-colors">
                    Brand Guidelines
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif font-bold text-headline mb-3">Contact</h3>
              <p className="text-sm text-foreground/70">
                Email:{" "}
                <a href={`mailto:${SITE.email}`} className="text-primary hover:underline">
                  {SITE.email}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

