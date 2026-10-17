import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { POST_CARD_COLUMNS, normalizePosts } from "@/lib/posts";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { Post } from "@/lib/types";
import { SITE } from "@/lib/site";
import { LoadError } from "@/components/LoadError";

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tag) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setPosts([]);
    (async () => {
      try {
        // React Router has already decoded this parameter; decoding twice crashes on "%".
        const result = await supabase.from("posts").select(POST_CARD_COLUMNS).eq("status", "published")
          .contains("keywords", [tag]).order("published_at", { ascending: false }).limit(60).abortSignal(controller.signal);
        if (result.error) throw result.error;
        if (active) setPosts(normalizePosts(result.data));
      } catch (cause) {
        if (active) { console.warn("[tag] Stories unavailable:", cause); setError(true); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [tag, attempt]);

  if (!tag) return <Navigate to="/" replace />;
  const decoded = tag;
  const title = `#${decoded}`;
  const description = `Stories tagged ${decoded} on ${SITE.name}.`;

  return (
    <Layout>
      <SEO
        title={`${title} — Stories`}
        description={description}
        path={`/tag/${encodeURIComponent(decoded)}`}
        keywords={[decoded]}
      />
      <section className="border-b border-rule bg-secondary/30">
        <div className="container-wide py-12">
          <nav aria-label="Breadcrumb" className="text-xs text-byline uppercase tracking-wider mb-4">
            <Link to="/" className="hover:text-primary">Home</Link> · <span>Tag</span>
          </nav>
          <span className="kicker text-primary">Tag</span>
          <h1 className="headline-hero mt-2">#{decoded}</h1>
          <p className="mt-4 text-foreground/80">{description}</p>
        </div>
      </section>
      <div className="container-wide py-12">
        {error ? <LoadError onRetry={() => setAttempt(value => value + 1)} /> : loading ? (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-72 bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center py-20 text-byline">No stories with this tag yet.</p>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
