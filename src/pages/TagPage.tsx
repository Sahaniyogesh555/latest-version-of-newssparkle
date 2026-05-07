import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { Post } from "@/lib/types";
import { SITE } from "@/lib/site";

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;
    const decoded = decodeURIComponent(tag);
    setLoading(true);
    supabase.from("posts").select("*").eq("status", "published")
      .contains("keywords", [decoded])
      .order("published_at", { ascending: false }).limit(60)
      .then(({ data }) => { setPosts((data as Post[]) || []); setLoading(false); });
  }, [tag]);

  if (!tag) return <Navigate to="/" replace />;
  const decoded = decodeURIComponent(tag);
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
          <nav className="text-xs text-byline uppercase tracking-wider mb-4">
            <Link to="/" className="hover:text-primary">Home</Link> · <span>Tag</span>
          </nav>
          <span className="kicker text-primary">Tag</span>
          <h1 className="headline-hero mt-2">#{decoded}</h1>
          <p className="mt-4 text-foreground/80">{description}</p>
        </div>
      </section>
      <div className="container-wide py-12">
        {loading ? (
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
