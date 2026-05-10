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
import { ShareBar } from "@/components/ShareBar";
import { StickyShareBar } from "@/components/StickyShareBar";
import { BookmarkButton } from "@/components/BookmarkButton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { TableOfContents } from "@/components/TableOfContents";
import { RelatedArticles } from "@/components/RelatedArticles";
import { TrendingSidebar } from "@/components/TrendingSidebar";
import { InlineRelatedStories } from "@/components/InlineRelatedStories";
import { HighlightedQuote } from "@/components/HighlightedQuote";
import { TrustIndicators, ArticleTrustHeader } from "@/components/TrustIndicators";
import { findAuthor } from "@/lib/authors";
import { CATEGORIES, formatDate, SITE } from "@/lib/site";
import { Clock, RefreshCw, Share2 } from "lucide-react";

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
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPost(data as Post);
      setLoading(false);
      supabase.rpc("increment_post_views", { post_slug: slug });
      const { data: rel } = await supabase
        .from("posts")
        .select("*")
        .eq("category_slug", (data as Post).category_slug)
        .eq("status", "published")
        .neq("id", (data as Post).id)
        .order("published_at", { ascending: false })
        .limit(6);
      setRelated((rel as Post[]) || []);
      window.scrollTo(0, 0);
    })();
  }, [slug]);

  if (notFound) return <Navigate to="/404" replace />;
  if (loading || !post)
    return (
      <Layout>
        <div className="container-prose py-20 animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-72 bg-muted rounded-lg" />
        </div>
      </Layout>
    );

  const cat = CATEGORIES.find((c) => c.slug === post.category_slug);
  const authorProfile = findAuthor(post.author);
  const wasUpdated = post.updated_at && post.updated_at !== post.published_at;

  const url = `${SITE.url}/post/${post.slug}`;
  const wordCount = post.content
    ? post.content.trim().split(/\s+/).length
    : undefined;
  const readingTime = post.reading_minutes || Math.max(1, Math.round((wordCount || 400) / 225));

  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: post.featured_image_url ? [post.featured_image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: [
      {
        "@type": "Person",
        name: authorProfile.name,
        url: `${SITE.url}/author/${authorProfile.slug}`,
        image: authorProfile.image,
        jobTitle: authorProfile.role,
        knowsAbout: authorProfile.beat,
        description: authorProfile.bio,
        sameAs: authorProfile.twitter ? [`https://twitter.com/${authorProfile.twitter.replace('@', '')}`] : undefined,
      },
    ],
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
      url: SITE.url,
      sameAs: SITE.twitter ? [`https://twitter.com/${SITE.twitter.replace('@', '')}`] : undefined,
      foundingDate: "2024",
      description: SITE.description,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: cat?.name,
    keywords: (post.keywords || []).join(", "),
    wordCount,
    inLanguage: "en",
    isAccessibleForFree: true,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".prose-article h2", ".prose-article h3", ".prose-article p"]
    },
    about: cat ? {
      "@type": "Thing",
      name: cat.name,
      description: cat.description
    } : undefined,
    mentions: (post.keywords || []).map(keyword => ({
      "@type": "Thing",
      name: keyword
    })),
    aggregateRating: post.views ? {
      "@type": "AggregateRating",
      ratingValue: Math.min(5, Math.max(1, Math.round((post.views / 1000) * 5))), // Scale views to 1-5 rating
      reviewCount: post.views,
      bestRating: 5,
      worstRating: 1
    } : undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      cat && {
        "@type": "ListItem",
        position: 2,
        name: cat.name,
        item: `${SITE.url}/category/${cat.slug}`,
      },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ].filter(Boolean),
  };

  const faqLd =
    post.faq && post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : undefined;

  const jsonLd = [articleLd, breadcrumbLd, ...(faqLd ? [faqLd] : [])];

  return (
    <Layout>
      <ReadingProgress />
      <StickyShareBar url={url} title={post.title} />
      <SEO
        title={post.meta_title || post.title}
        description={post.meta_description}
        path={`/post/${post.slug}`}
        image={post.featured_image_url || undefined}
        type="article"
        keywords={post.keywords || []}
        publishedAt={post.published_at}
        author={post.author}
        category={cat?.name}
        jsonLd={jsonLd}
      />

      <article className="min-h-screen" aria-labelledby="article-title">
        {/* Article Header */}
        <header className="bg-gradient-to-b from-secondary/30 via-secondary/10 to-transparent border-b border-border/50">
          <div className="container-prose py-12 sm:py-16">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-byline uppercase tracking-wider mb-6">
              <Link to="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span>/</span>
              {cat && (
                <>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="hover:text-primary transition-colors"
                    style={{ color: `hsl(var(--${cat.color}))` }}
                  >
                    {cat.name}
                  </Link>
                  <span>/</span>
                </>
              )}
              <span className="text-byline">{post.title?.substring(0, 40)}...</span>
            </nav>

            {/* Category badge */}
            {cat && (
              <span
                className="kicker inline-block mb-4"
                style={{ color: `hsl(var(--${cat.color}))` }}
              >
                {cat.name}
              </span>
            )}

            {/* Main headline */}
            <h1 id="article-title" className="headline-hero text-left mb-8 leading-[1.1] tracking-tight">
              {post.title}
            </h1>

            {/* Subheading/Excerpt */}
            <p className="text-xl text-foreground/80 leading-relaxed font-light mb-8">
              {post.excerpt}
            </p>

            <aside className="mb-8 rounded-3xl border border-border/70 bg-primary/5 p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="kicker text-primary uppercase tracking-[0.3em] text-[11px] font-semibold">
                  Story snapshot
                </span>
                <span className="text-xs uppercase tracking-[0.3em] text-byline">
                  Editorial summary
                </span>
              </div>
              {post.key_takeaways && post.key_takeaways.length > 0 ? (
                <ul className="grid gap-3 text-foreground/85 sm:grid-cols-2">
                  {post.key_takeaways.slice(0, 4).map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="mt-1 text-primary font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground/85 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
            </aside>

            {/* Article metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-t border-border pt-6 flex-wrap">
              <Link
                to={`/author/${authorProfile.slug}`}
                className="flex items-center gap-3 hover:no-underline group"
              >
                <AuthorImage
                  author={authorProfile}
                  size="sm"
                  ring={false}
                />
                <div>
                  <p className="font-semibold text-headline group-hover:text-primary transition-colors text-sm">
                    {authorProfile.name}
                  </p>
                  <p className="text-xs text-byline">{authorProfile.role}</p>
                </div>
              </Link>

              <div className="flex items-center gap-4 sm:gap-6 text-xs text-byline uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <time dateTime={post.published_at}>
                    {formatDate(post.published_at)}
                  </time>
                </span>
                {wasUpdated && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <RefreshCw className="size-3" />
                    <time dateTime={post.updated_at!}>
                      Updated {formatDate(post.updated_at!)}
                    </time>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  {readingTime} min read
                </span>
              </div>

              {/* Sticky actions */}
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <ShareBar
                  url={url}
                  title={post.title}
                  compact
                />
                <BookmarkButton
                  post={{
                    slug: post.slug,
                    title: post.title,
                    excerpt: post.excerpt,
                    category_slug: post.category_slug,
                    featured_image_url: post.featured_image_url,
                    published_at: post.published_at,
                  }}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Featured image */}
        {post.featured_image_url && (
          <div className="container-prose mt-8">
            <figure>
              <OptimizedImage
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                loading="eager"
                priority
                width={1200}
                height={675}
                className="w-full aspect-[16/9] object-cover rounded-lg border border-border"
              />
              {post.featured_image_alt && (
                <figcaption className="mt-3 text-xs text-byline italic">
                  {post.featured_image_alt}
                </figcaption>
              )}
            </figure>
          </div>
        )}

        {/* Article content with sidebar */}
        <div className="container-wide py-16 sm:py-20">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-4">
            {/* Main content */}
            <div className="lg:col-span-3">
              <div className="ad-slot mb-12" data-ad-slot="article-top">
                Advertisement
              </div>

              <section aria-label="Article body" className="prose-article">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children, ...props }) => {
                      const isExternal =
                        href &&
                        /^https?:\/\//i.test(href) &&
                        !href.includes(new URL(SITE.url).hostname);
                      return isExternal ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          {...props}
                        >
                          {children}
                        </a>
                      ) : (
                        <a href={href} {...props}>
                          {children}
                        </a>
                      );
                    },
                    img: ({ src, alt, ...props }) => (
                      <OptimizedImage
                        src={typeof src === "string" ? src : ""}
                        alt={alt || post.title}
                        loading="lazy"
                        className="w-full rounded-lg border border-border"
                        {...props}
                      />
                    ),
                    blockquote: ({ children, ...props }) => {
                      // Check if it's a highlighted quote (starts with >!)
                      const content = Array.isArray(children) ? children.join('') : String(children);
                      if (content.trim().startsWith('>!')) {
                        const quoteText = content.replace(/^>!\s*/, '');
                        return <HighlightedQuote>{quoteText}</HighlightedQuote>;
                      }
                      return <blockquote {...props}>{children}</blockquote>;
                    },
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </section>

              {/* Key takeaways */}
              {post.key_takeaways && post.key_takeaways.length > 0 && (
                <aside className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg">
                  <h3 className="font-serif text-lg font-bold mb-4 text-headline">
                    Key Takeaways
                  </h3>
                  <ul className="space-y-3 text-foreground/90">
                    {post.key_takeaways.map((t, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="text-primary font-bold mt-1">›</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}

              <section className="mt-12 rounded-3xl border border-border/70 bg-secondary/10 p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="sm:max-w-xl">
                    <p className="kicker text-primary uppercase tracking-[0.3em] text-[11px] font-semibold mb-3">
                      Author expertise
                    </p>
                    <h2 className="font-serif text-2xl font-bold text-headline">
                      Reporting from {authorProfile.name}
                    </h2>
                    <p className="mt-3 text-foreground/80 leading-relaxed">
                      {authorProfile.bio}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-card border border-border p-5 text-sm text-foreground/85 shadow-sm">
                    <p className="font-semibold text-headline">Coverage focus</p>
                    <p className="mt-3">{authorProfile.beat}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-byline">
                        {cat?.name}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-byline">
                        {readingTime} min read
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Inline related stories */}
              {related.length > 3 && (
                <InlineRelatedStories posts={related.slice(0, 3)} />
              )}

              <div className="ad-slot my-12" data-ad-slot="article-bottom">
                Advertisement
              </div>

              {/* FAQ section */}
              {post.faq && post.faq.length > 0 && (
                <section className="mt-12 border-t border-rule pt-12">
                  <h2 className="headline-lg mb-8">Frequently Asked Questions</h2>
                  <div className="space-y-8">
                    {post.faq.map((f, i) => (
                      <div key={i} className="">
                        <h3 className="font-serif text-lg font-semibold text-headline mb-3">
                          {f.q}
                        </h3>
                        <p className="text-foreground/85 leading-relaxed">{f.a}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Tags */}
              {post.keywords && post.keywords.length > 0 && (
                <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-2">
                  {post.keywords.map((k) => (
                    <Link
                      key={k}
                      to={`/tag/${encodeURIComponent(k)}`}
                      className="text-xs uppercase tracking-wider bg-muted px-3 py-1.5 text-byline hover:bg-primary hover:text-primary-foreground transition-colors rounded"
                    >
                      #{k}
                    </Link>
                  ))}
                </div>
              )}

              {/* Author bio card */}
              <ArticleTrustHeader
                author={{
                  name: authorProfile.name,
                  role: authorProfile.role,
                  image: authorProfile.image
                }}
                publishedAt={post.published_at}
                updatedAt={post.updated_at}
                views={post.views}
                readingTime={readingTime}
                category={cat?.name}
              />
            </div>
            {/* Sidebar */}
            <aside className="lg:col-span-1 space-y-8">
              <TableOfContents />
              <TrendingSidebar />
            </aside>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <RelatedArticles post={post} posts={related} />
        )}
      </article>
    </Layout>
  );
}
