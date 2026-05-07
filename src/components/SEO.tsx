import { Helmet } from "react-helmet-async";
import { SITE } from "@/lib/site";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  keywords?: string[];
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  category?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function SEO({ title, description, path = "/", image, type = "website", keywords, publishedAt, updatedAt, author, category, jsonLd }: SEOProps) {
  const url = `${SITE.url}${path}`;
  const fullTitle = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;
  const ogImage = image || `${SITE.url}/og-default.jpg`;

  const baseLd: Record<string, unknown> = type === "article" ? {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: [ogImage],
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: [{ "@type": "Person", name: author || SITE.publisher }],
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: category,
    keywords: keywords?.join(", "),
  } : {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    publisher: { "@type": "Organization", name: SITE.name },
  };

  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? [baseLd, ...jsonLd] : [baseLd, jsonLd]) : [baseLd];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE.name} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {publishedAt && <meta property="article:published_time" content={publishedAt} />}
      {updatedAt && <meta property="article:modified_time" content={updatedAt} />}
      {author && <meta name="author" content={author} />}
      {category && <meta property="article:section" content={category} />}
      <script type="application/ld+json">{JSON.stringify(ldArray)}</script>
    </Helmet>
  );
}
