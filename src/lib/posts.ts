import type { Json } from "@/integrations/supabase/types";
import type { Post } from "@/lib/types";

export type FaqItem = { q: string; a: string };

/**
 * Columns needed to render a post card / list row.
 *
 * Queries used to be `select("*")`, which pulled the full multi-kilobyte
 * `content` (and FAQ, keywords and meta fields) for every card, rail and
 * pagination page. Article bodies are fetched only by PostPage.
 */
export const POST_CARD_COLUMNS =
  "id,title,slug,excerpt,featured_image_url,featured_image_alt,category_slug,author,status,reading_minutes,views,published_at,created_at,updated_at,keywords,key_takeaways" as const;

/** Card columns plus everything the article page needs. */
export const POST_FULL_COLUMNS =
  "id,title,slug,excerpt,featured_image_url,featured_image_alt,category_slug,author,status,reading_minutes,views,published_at,created_at,updated_at,keywords,key_takeaways,content,meta_title,meta_description,faq" as const;

/**
 * Runtime guards for rows coming back from the `posts` table.
 *
 * `select("*")` returns the generated `Database` row shape, where `faq` is an
 * arbitrary `Json` value and `keywords` is `string[] | null`. The UI needs the
 * narrower, safe shapes below — a malformed row should never blank a page.
 */
export function toFaq(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const q = (entry as { q?: unknown }).q;
    const a = (entry as { a?: unknown }).a;
    if (typeof q !== "string" || typeof a !== "string") return [];
    return [{ q, a }];
  });
}

export function toKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

export function toTakeaways(value: unknown): string[] {
  return toKeywords(value);
}

/** Normalise a single DB row into a UI-safe `Post`. */
export function normalizePost(row: unknown): Post {
  const r = (row ?? {}) as Record<string, unknown> & { faq?: Json };
  return {
    ...(r as unknown as Post),
    keywords: toKeywords(r.keywords),
    key_takeaways: toTakeaways(r.key_takeaways),
    faq: toFaq(r.faq),
  };
}

/** Normalise a list of DB rows into UI-safe `Post[]`. */
export function normalizePosts(rows: unknown): Post[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizePost);
}
