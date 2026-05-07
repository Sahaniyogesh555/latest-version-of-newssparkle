import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { SEO } from "@/components/SEO";
import { CATEGORIES, SITE, formatDate } from "@/lib/site";
import { Link } from "react-router-dom";

export default function Index() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("posts").select("*").eq("status", "published")
      .order("published_at", { ascending: false }).limit(30)
      .then(({ data }) => { setPosts((data as Post[]) || []); setLoading(false); });
  }, []);

  const hero = posts[0];
  const latest = posts.slice(1, 13);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) for (const k of (p.keywords || [])) {
      const tag = k.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [posts]);

  const todayLabel = formatDate(new Date().toISOString()).toUpperCase();

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
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/?s={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Layout>
      <SEO title={`${SITE.name} — ${SITE.tagline}`} description={SITE.description} path="/" jsonLd={websiteLd} />

      {/* Issue masthead */}
      <section className="container-wide pt-14 sm:pt-20 pb-10 text-center">
        <div className="kicker text-primary">ISSUE · {todayLabel}</div>
        <h1 className="headline-hero mt-5 max-w-4xl mx-auto">
          {SITE.name} — Breaking news, politics, business, tech &amp; <em className="not-italic text-primary font-serif italic">more.</em>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-foreground/70 leading-relaxed">
          {SITE.description}
        </p>
      </section>

      <div className="container-wide"><div className="border-t border-border" /></div>

      {/* Featured story */}
      <section className="container-wide py-12 sm:py-16">
        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-80 bg-muted rounded" />
            <div className="h-8 bg-muted w-3/4 rounded" />
          </div>
        ) : hero ? (
          <PostCard post={hero} variant="hero" />
        ) : (
          <div className="text-center py-20">
            <h2 className="font-serif text-3xl font-bold">Stories arriving shortly</h2>
            <p className="mt-3 text-byline">Our editorial desk publishes fresh reporting every four hours.</p>
          </div>
        )}
      </section>

      {/* Browse the desk */}
      <section className="bg-secondary/60 border-y border-border">
        <div className="container-wide py-10">
          <div className="kicker text-byline mb-5">BROWSE THE DESK</div>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map(c => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="px-5 py-2.5 border border-border bg-background text-[15px] font-medium text-headline hover:border-primary hover:text-primary transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest stories */}
      {latest.length > 0 && (
        <section className="container-wide py-14 sm:py-20">
          <div className="flex items-baseline justify-between mb-10 pb-4 border-b border-rule">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-headline">Latest stories</h2>
            <span className="kicker text-byline hidden sm:inline">Updated continuously</span>
          </div>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <section className="border-y border-border bg-muted/40">
          <div className="container-wide py-12">
            <div className="kicker text-primary mb-4">TRENDING</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-headline mb-6">
              What people are reading about
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {trendingTags.map(tag => (
                <span
                  key={tag}
                  className="px-3.5 py-1.5 text-sm bg-background border border-border text-foreground/80 hover:border-primary hover:text-primary transition-colors cursor-default"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      <section className="container-wide py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="kicker text-primary mb-4">THE BRIEF</div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-headline leading-[1.1]">
            One email. <em className="text-primary not-italic italic font-serif">Every morning.</em>
          </h2>
          <p className="mt-5 text-lg text-foreground/70 leading-relaxed">
            The stories that matter, written for the curious and edited for the busy. Delivered before your first coffee.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); }}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="flex-1 px-4 py-3 bg-background border border-border focus:border-primary focus:outline-none text-base"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold text-[15px] tracking-wide hover:bg-primary/90 transition-colors"
            >
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-xs text-byline uppercase tracking-wider">
            Free · Unsubscribe anytime
          </p>
        </div>
      </section>
    </Layout>
  );
}
