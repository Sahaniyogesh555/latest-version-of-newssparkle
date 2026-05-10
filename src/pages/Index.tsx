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
      <section className="container-wide pt-12 sm:pt-16 pb-8">
        <div className="text-center mb-8">
          <div className="kicker text-primary mb-3">TODAY'S ISSUE · {todayLabel}</div>
          <h1 className="headline-hero max-w-4xl mx-auto">
            {SITE.name} — Breaking news, politics, business, tech <em className="not-italic text-primary font-serif italic">& more</em>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-foreground/70 leading-relaxed">
            {SITE.description}
          </p>
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
        <section className="container-wide py-12 sm:py-16">
          <div className="flex items-baseline justify-between mb-10 pb-4 border-b border-rule">
            <h2 className="headline-lg">Latest Stories</h2>
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
              {loadingMore && (
                <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-80 bg-muted rounded-lg" />
                  ))}
                </div>
              )}
              {!hasMore && latest.length > 0 && (
                <p className="text-center text-byline text-sm uppercase tracking-wider mt-12">
                  — End of feed —
                </p>
              )}
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

