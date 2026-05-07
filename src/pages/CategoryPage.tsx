import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { SEO } from "@/components/SEO";
import { CATEGORIES, SITE } from "@/lib/site";
import { CATEGORY_FAQS } from "@/lib/categoryFaqs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TrendingUp, ArrowRight } from "lucide-react";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const cat = CATEGORIES.find(c => c.slug === slug);
  const [posts, setPosts] = useState<Post[]>([]);
  const [trending, setTrending] = useState<Post[]>([]);
  const [otherPool, setOtherPool] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.from("posts").select("*").eq("category_slug", slug).eq("status", "published")
      .order("published_at", { ascending: false }).limit(60)
      .then(({ data }) => { setPosts((data as Post[]) || []); setLoading(false); });

    // Trending = most-viewed published posts site-wide, excluding the current category
    supabase.from("posts").select("*").eq("status", "published").neq("category_slug", slug)
      .order("views", { ascending: false }).limit(6)
      .then(({ data }) => setTrending((data as Post[]) || []));

    // Wider pool for tag-based related-posts matching
    supabase.from("posts").select("*").eq("status", "published").neq("category_slug", slug)
      .order("published_at", { ascending: false }).limit(120)
      .then(({ data }) => setOtherPool((data as Post[]) || []));
  }, [slug]);

  const relatedCats = useMemo(
    () => CATEGORIES.filter(c => c.slug !== slug),
    [slug]
  );

  // Related posts: weighted scoring across multiple signals.
  //  - Title/heading token overlap (highest signal)  → ×3
  //  - Entity overlap (capitalised proper nouns)     → ×2
  //  - Keyword/tag overlap                           → ×1
  // Common stop-words and short tokens are ignored.
  const relatedPosts = useMemo(() => {
    if (posts.length === 0 || otherPool.length === 0) return [];

    const STOP = new Set([
      "the","a","an","and","or","but","of","in","on","for","to","with","by","at","from",
      "is","are","was","were","be","been","being","as","it","its","this","that","these",
      "those","than","then","into","over","about","after","before","new","says","said",
      "how","why","what","when","who","you","your","our","their","not","no","vs","amid",
    ]);

    const tokenize = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP.has(t));

    const extractEntities = (s: string) => {
      // Naive entity extractor: capitalised words / multi-word proper nouns.
      const matches = (s || "").match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\b/g) || [];
      return matches.map(m => m.toLowerCase()).filter(m => m.length > 2);
    };

    // Build the source pools from THIS category's posts.
    const titlePool = new Set<string>();
    const entityPool = new Set<string>();
    const tagPool = new Set<string>();
    for (const p of posts) {
      tokenize(p.title).forEach(t => titlePool.add(t));
      extractEntities(p.title).forEach(e => entityPool.add(e));
      extractEntities(p.excerpt || "").forEach(e => entityPool.add(e));
      for (const k of (p.keywords || [])) {
        const t = k.trim().toLowerCase();
        if (t) tagPool.add(t);
      }
    }

    if (titlePool.size === 0 && tagPool.size === 0 && entityPool.size === 0) return [];

    const W_TITLE = 3;
    const W_ENTITY = 2;
    const W_TAG = 1;

    const scored = otherPool
      .map(p => {
        const titleHits = tokenize(p.title).reduce(
          (acc, t) => acc + (titlePool.has(t) ? 1 : 0), 0
        );
        const entityHits = [
          ...extractEntities(p.title),
          ...extractEntities(p.excerpt || ""),
        ].reduce((acc, e) => acc + (entityPool.has(e) ? 1 : 0), 0);
        const tagHits = (p.keywords || []).reduce(
          (acc, k) => acc + (tagPool.has(k.trim().toLowerCase()) ? 1 : 0), 0
        );
        const score = titleHits * W_TITLE + entityHits * W_ENTITY + tagHits * W_TAG;
        return { post: p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(x => x.post);

    return scored;
  }, [posts, otherPool, slug]);


  if (!cat) return <Navigate to="/404" replace />;

  const url = `${SITE.url}/category/${cat.slug}`;
  const description = `The latest ${cat.name.toLowerCase()} news, in-depth analysis and breaking stories from the ${SITE.name} editorial desk.`;

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.name} News & Analysis`,
    description,
    url,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    about: { "@type": "Thing", name: cat.name },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: cat.name, item: url },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: posts.length,
      itemListElement: posts.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE.url}/post/${p.slug}`,
        name: p.title,
      })),
    },
  };

  const faqs = CATEGORY_FAQS[cat.slug] || [];
  const faqLd = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : null;

  const jsonLd = faqLd ? [collectionLd, faqLd] : collectionLd;

  return (
    <Layout>
      <SEO
        title={`${cat.name} News & Analysis`}
        description={description}
        path={`/category/${cat.slug}`}
        jsonLd={jsonLd}
      />
      <section className="border-b border-rule bg-secondary/30">
        <div className="container-wide py-12">
          <nav aria-label="Breadcrumb" className="text-xs text-byline uppercase tracking-wider mb-4">
            <Link to="/" className="hover:text-primary">Home</Link>
            <span className="mx-2">·</span>
            <span style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</span>
          </nav>
          <span className="kicker" style={{ color: `hsl(var(--${cat.color}))` }}>Section</span>
          <h1 className="headline-hero mt-2">{cat.name}</h1>
          <p className="mt-4 max-w-2xl text-lg text-foreground/80">
            In-depth {cat.name.toLowerCase()} reporting, analysis and live updates from around the world.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.filter(c => c.slug !== cat.slug).map(c => (
              <Link key={c.slug} to={`/category/${c.slug}`} className="text-xs uppercase tracking-wider px-3 py-1.5 border border-border hover:border-primary hover:text-primary">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container-wide py-12">
        {loading ? (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-80 bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-byline">
            <p>No stories published in this section yet. Check back shortly.</p>
          </div>
        ) : (
          <>
            {posts[0] && <div className="mb-12 pb-12 border-b border-border"><PostCard post={posts[0]} variant="hero" /></div>}
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(1).map(p => <PostCard key={p.id} post={p} />)}
            </div>
          </>
        )}
      </div>

      {/* Related posts (tag-based, cross-category) */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-border">
          <div className="container-wide py-12">
            <span className="kicker text-primary">Related reading</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-headline mt-2 mb-2">
              Stories connected to {cat.name.toLowerCase()}
            </h2>
            <p className="text-byline text-sm mb-8">
              Hand-picked from other sections based on shared topics and entities.
            </p>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {relatedPosts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Trending across the desk */}
      {trending.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="container-wide py-12">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="size-4 text-primary" />
              <span className="kicker text-primary">Trending across NewsSparkle</span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((p, i) => {
                const pcat = CATEGORIES.find(c => c.slug === p.category_slug);
                return (
                  <li key={p.id} className="border-b border-border pb-4 sm:border-0 sm:pb-0">
                    <Link to={`/post/${p.slug}`} className="group flex gap-4 items-start">
                      <span className="font-serif text-3xl font-black text-byline/40 leading-none w-10 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        {pcat && (
                          <span
                            className="kicker block mb-1"
                            style={{ color: `hsl(var(--${pcat.color}))` }}
                          >
                            {pcat.name}
                          </span>
                        )}
                        <h3 className="font-serif text-lg font-semibold text-headline leading-snug group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Related sections */}
      <section className="border-t border-border">
        <div className="container-wide py-12">
          <span className="kicker text-byline">Explore other sections</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-headline mt-2 mb-6">
            More from the {SITE.name} desk
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedCats.map(rc => (
              <Link
                key={rc.slug}
                to={`/category/${rc.slug}`}
                className="group flex items-center justify-between p-5 border border-border hover:border-primary transition-colors"
              >
                <div>
                  <span
                    className="kicker block"
                    style={{ color: `hsl(var(--${rc.color}))` }}
                  >
                    Section
                  </span>
                  <span className="font-serif text-lg font-semibold text-headline group-hover:text-primary transition-colors">
                    {rc.name}
                  </span>
                </div>
                <ArrowRight className="size-4 text-byline group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="border-t border-border bg-secondary/30">
          <div className="container-prose py-14">
            <span className="kicker text-primary">FAQ</span>
            <h2 className="font-serif text-3xl font-bold mt-2 text-headline">{cat.name} — Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="mt-8">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left font-serif text-lg font-semibold text-headline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-foreground/85 leading-relaxed text-base">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}
    </Layout>
  );
}
