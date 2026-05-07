import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { SEO } from "@/components/SEO";
import { ReadingProgress } from "@/components/ReadingProgress";
import { AuthorBio } from "@/components/AuthorBio";
import { ShareBar } from "@/components/ShareBar";
import { BookmarkButton } from "@/components/BookmarkButton";
import { findAuthor } from "@/lib/authors";
import { CATEGORIES, formatDate, SITE } from "@/lib/site";
import { Clock, RefreshCw } from "lucide-react";

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const { data } = await supabase.from("posts").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setPost(data as Post);
      setLoading(false);
      supabase.rpc("increment_post_views", { post_slug: slug });
      const { data: rel } = await supabase.from("posts").select("*")
        .eq("category_slug", (data as Post).category_slug).eq("status", "published")
        .neq("id", (data as Post).id).order("published_at", { ascending: false }).limit(3);
      setRelated((rel as Post[]) || []);
      window.scrollTo(0, 0);
    })();
  }, [slug]);

  if (notFound) return <Navigate to="/404" replace />;
  if (loading || !post) return <Layout><div className="container-prose py-20 animate-pulse space-y-4"><div className="h-12 bg-muted" /><div className="h-72 bg-muted" /></div></Layout>;

  const cat = CATEGORIES.find(c => c.slug === post.category_slug);
  const authorProfile = findAuthor(post.author);
  const wasUpdated = post.updated_at && post.updated_at !== post.published_at;

  const url = `${SITE.url}/post/${post.slug}`;
  const wordCount = post.content ? post.content.trim().split(/\s+/).length : undefined;

  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: post.featured_image_url ? [post.featured_image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: [{ "@type": "Person", name: authorProfile.name, url: `${SITE.url}/author/${authorProfile.slug}`, image: authorProfile.image, jobTitle: authorProfile.role }],
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: cat?.name,
    keywords: (post.keywords || []).join(", "),
    wordCount,
    inLanguage: "en",
    isAccessibleForFree: true,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      cat && { "@type": "ListItem", position: 2, name: cat.name, item: `${SITE.url}/category/${cat.slug}` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ].filter(Boolean),
  };

  const faqLd = post.faq && post.faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : undefined;

  const jsonLd = [articleLd, breadcrumbLd, ...(faqLd ? [faqLd] : [])];

  return (
    <Layout>
      <ReadingProgress />
      <SEO
        title={post.meta_title || post.title}
        description={post.meta_description}
        path={`/post/${post.slug}`}
        image={post.featured_image_url || undefined}
        type="article"
        keywords={post.keywords || []}
        publishedAt={post.published_at}
        updatedAt={post.updated_at}
        author={post.author}
        category={cat?.name}
        jsonLd={jsonLd}
      />

      <article>
        <header className="bg-secondary/30 border-b border-border">
          <div className="container-prose py-10 sm:py-14">
            <div className="text-xs text-byline uppercase tracking-wider mb-4">
              <Link to="/" className="hover:text-primary">Home</Link> · {cat && <Link to={`/category/${cat.slug}`} className="hover:text-primary" style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</Link>}
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] tracking-tight text-headline">{post.title}</h1>
            <p className="mt-5 text-lg sm:text-xl text-foreground/80 leading-relaxed font-light">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-byline uppercase tracking-wider border-t border-border pt-4">
              <Link to={`/author/${authorProfile.slug}`} className="flex items-center gap-2 hover:text-primary">
                <img src={authorProfile.image} alt="" width={28} height={28} loading="lazy" decoding="async" className="size-7 rounded-full bg-muted object-cover" />
                <span className="font-semibold text-headline normal-case tracking-normal">{authorProfile.name}</span>
              </Link>
              <span>{formatDate(post.published_at)}</span>
              {wasUpdated && <span className="flex items-center gap-1 text-primary"><RefreshCw className="size-3" /> Updated {formatDate(post.updated_at)}</span>}
              <span className="flex items-center gap-1"><Clock className="size-3" /> {post.reading_minutes} min read</span>
              <span className="ml-auto flex items-center gap-3">
                <BookmarkButton post={{ slug: post.slug, title: post.title, excerpt: post.excerpt, category_slug: post.category_slug, featured_image_url: post.featured_image_url, published_at: post.published_at }} showLabel />
              </span>
            </div>
            <div className="mt-4">
              <ShareBar url={url} title={post.title} />
            </div>
          </div>
        </header>

        {post.featured_image_url && (
          <div className="container-prose mt-8">
            <figure>
              <img src={post.featured_image_url} alt={post.featured_image_alt || post.title} loading="eager" decoding="async" fetchPriority="high" className="w-full aspect-[16/9] object-cover" />
              {post.featured_image_alt && <figcaption className="mt-2 text-xs text-byline italic">{post.featured_image_alt}</figcaption>}
            </figure>
          </div>
        )}

        <div className="container-prose py-10">
          <div className="ad-slot mb-10" data-ad-slot="article-top">Advertisement</div>

          <div className="prose-article">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  const isExternal = href && /^https?:\/\//i.test(href) && !href.includes(new URL(SITE.url).hostname);
                  return isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>{children}</a>
                  ) : (
                    <a href={href} {...props}>{children}</a>
                  );
                },
                img: ({ src, alt, ...props }) => (
                  <img src={src} alt={alt || post.title} loading="lazy" {...props} />
                ),
              }}
            >{post.content}</ReactMarkdown>
          </div>

          {post.key_takeaways && post.key_takeaways.length > 0 && (
            <aside className="mt-10 p-6 bg-secondary border-l-4 border-primary">
              <h2 className="font-serif text-xl font-bold mb-3">Key Takeaways</h2>
              <ul className="space-y-2 text-foreground/90">
                {post.key_takeaways.map((t, i) => <li key={i} className="flex gap-3"><span className="text-primary font-bold">›</span><span>{t}</span></li>)}
              </ul>
            </aside>
          )}

          <div className="ad-slot my-10" data-ad-slot="article-bottom">Advertisement</div>

          {post.faq && post.faq.length > 0 && (
            <section className="mt-10">
              <div className="rule-top mb-5"><h2 className="font-serif text-2xl font-bold">Frequently Asked Questions</h2></div>
              <div className="space-y-5">
                {post.faq.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-serif text-lg font-semibold text-headline">{f.q}</h3>
                    <p className="mt-2 text-foreground/85 leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {post.keywords && post.keywords.length > 0 && (
            <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-2">
              {post.keywords.map(k => (
                <Link key={k} to={`/tag/${encodeURIComponent(k)}`} className="text-xs uppercase tracking-wider bg-muted px-2.5 py-1 text-byline hover:bg-primary hover:text-primary-foreground transition-colors">{k}</Link>
              ))}
            </div>
          )}

          <AuthorBio author={authorProfile} publishedAt={post.published_at} updatedAt={post.updated_at} readingMinutes={post.reading_minutes} />
        </div>

        {related.length > 0 && (
          <section className="bg-secondary/30 border-t border-rule">
            <div className="container-wide py-12">
              <div className="rule-top mb-6"><h2 className="font-serif text-2xl font-bold">More from {cat?.name}</h2></div>
              <div className="grid gap-10 md:grid-cols-3">
                {related.map(r => <PostCard key={r.id} post={r} />)}
              </div>
            </div>
          </section>
        )}
      </article>
    </Layout>
  );
}
