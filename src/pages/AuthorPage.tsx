import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { AuthorImage } from "@/components/AuthorImage";
import { findAuthorBySlug } from "@/lib/authors";
import { Post } from "@/lib/types";
import { SITE } from "@/lib/site";

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const author = slug ? findAuthorBySlug(slug) : undefined;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!author) return;
    setLoading(true);
    supabase
      .from("posts")
      .select("*")
      .eq("author", author.name)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setPosts((data as Post[]) || []);
        setLoading(false);
      });
  }, [author]);

  if (!author) return <Navigate to="/404" replace />;

  const url = `${SITE.url}/author/${author.slug}`;
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.role,
    knowsAbout: author.beat,
    description: author.bio,
    image: author.image,
    url,
    worksFor: { "@type": "NewsMediaOrganization", name: SITE.name, url: SITE.url },
  };

  return (
    <Layout>
      <SEO
        title={`${author.name} — Author Profile`}
        description={author.bio}
        path={`/author/${author.slug}`}
        image={author.image}
        author={author.name}
        jsonLd={personLd}
      />
      <div className="container-prose py-14">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> ·{" "}
          <Link to="/authors" className="hover:text-primary">Authors</Link> ·{" "}
          <span>{author.name}</span>
        </nav>
        <header className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <AuthorImage
            author={author}
            size="xl"
            className="ring-2 shrink-0"
          />
          <div>
            <span className="kicker text-primary">{author.role}</span>
            <h1 className="font-serif text-3xl sm:text-4xl font-black text-headline mt-1">{author.name}</h1>
            <p className="text-sm text-primary mt-1 font-semibold">{author.beat}</p>
            <p className="mt-3 text-foreground/85 leading-relaxed max-w-2xl">{author.bio}</p>
          </div>
        </header>
      </div>

      <section className="container-wide pb-16">
        <div className="rule-top mb-8 pt-4">
          <h2 className="font-serif text-2xl font-bold">Latest stories by {author.name}</h2>
        </div>
        {loading ? (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-72 bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-byline">No published stories yet for this author.</p>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>
    </Layout>
  );
}
