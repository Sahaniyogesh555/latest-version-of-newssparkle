import { Helmet } from "react-helmet-async";
import { SITE } from "@/lib/site";

interface BreadcrumbItem {
  position: number;
  name: string;
  item: string;
}

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
  breadcrumbs?: BreadcrumbItem[];
  robots?: string;
  twitterCreator?: string;
  lang?: string;
  languages?: Array<{ code: string; href: string }>;
}

export function SEO({
  title,
  description,
  path = "/",
  image,
  type = "website",
  keywords,
  publishedAt,
  updatedAt,
  author,
  category,
  jsonLd,
  breadcrumbs,
  robots = "index, follow",
  twitterCreator,
  lang = "en",
  languages,
}: SEOProps) {
  const url = `${SITE.url}${path}`;
  const fullTitle = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;
  const ogImage = image || `${SITE.url}/og-default.jpg`;
  const twitterHandle = twitterCreator || SITE.twitter;
  const locale = lang === "hi" ? "hi_IN" : lang === "en" ? "en_US" : "en_US";
  const alternateLinks = languages || [{ code: "en", href: url }];

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
      "@type": "NewsMediaOrganization",
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
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const breadcrumbLd = breadcrumbs && breadcrumbs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map(item => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      item: item.item,
    })),
  } : undefined;

  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? [baseLd, ...(breadcrumbLd ? [breadcrumbLd] : []), ...jsonLd]
      : [baseLd, ...(breadcrumbLd ? [breadcrumbLd] : []), jsonLd]
    : [baseLd, ...(breadcrumbLd ? [breadcrumbLd] : [])];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      {keywords && keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={locale} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE.twitter} />
      <meta name="twitter:creator" content={twitterHandle} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <link rel="manifest" href="/manifest.json" />
      <link rel="alternate" hrefLang="x-default" href={url} />
      {alternateLinks.map((link) => (
        <link key={link.code} rel="alternate" hrefLang={link.code} href={link.href} />
      ))}
      {publishedAt && <meta property="article:published_time" content={publishedAt} />}
      {updatedAt && <meta property="article:modified_time" content={updatedAt} />}
      {author && <meta name="author" content={author} />}
      {category && <meta property="article:section" content={category} />}
      {type === "article" && <meta property="article:publisher" content={SITE.url} />}
      {type === "article" && keywords && keywords.length > 0 && (
        <meta name="news_keywords" content={keywords.join(", ")} />
      )}
      <script type="application/ld+json">{JSON.stringify(ldArray)}</script>
    </Helmet>
  );
}
