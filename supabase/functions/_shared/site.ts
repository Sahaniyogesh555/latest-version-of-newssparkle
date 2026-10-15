// Shared site constants for the edge functions.
// Keep in sync with src/lib/site.ts and src/lib/authors.ts.

export const SITE_NAME = "NewsSparkle";

export function siteUrl(): string {
  return (Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app").replace(/\/$/, "");
}

export const CATEGORY_SLUGS = [
  "breaking-news",
  "politics",
  "business",
  "technology",
  "health",
  "entertainment",
] as const;

/** Indexable static pages (excludes /search and /bookmarks, which are disallowed in robots.txt). */
export const STATIC_PAGES = [
  "about",
  "authors",
  "contact",
  "privacy",
  "privacy-policy",
  "terms",
  "disclaimer",
  "faq",
  "brand",
  "editorial-policy",
  "corrections",
];

export const AUTHOR_SLUGS = [
  "editorial-desk",
  "politics-desk",
  "business-desk",
  "technology-desk",
  "health-desk",
  "entertainment-desk",
] as const;
