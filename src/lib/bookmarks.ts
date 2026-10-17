import { readStorage, writeStorage } from "@/lib/storage";

// Lightweight bookmarks store. No account or server-side collection is involved.
const KEY = "ns_bookmarks_v1";

export interface BookmarkedPost {
  slug: string;
  title: string;
  excerpt: string;
  category_slug: string;
  featured_image_url: string | null;
  published_at: string;
  saved_at: string;
}

function isBookmark(value: unknown): value is BookmarkedPost {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return ["slug", "title", "excerpt", "category_slug", "published_at", "saved_at"].every(key => typeof b[key] === "string")
    && Boolean(b.slug && b.title)
    && (b.featured_image_url === null || typeof b.featured_image_url === "string")
    && Number.isFinite(Date.parse(b.published_at as string))
    && Number.isFinite(Date.parse(b.saved_at as string));
}

const read = (): BookmarkedPost[] => {
  try {
    const stored: unknown = JSON.parse(readStorage(KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(isBookmark).slice(0, 200) : [];
  } catch {
    return [];
  }
};

const write = (list: BookmarkedPost[]): boolean => {
  if (!writeStorage(KEY, JSON.stringify(list))) return false;
  window.dispatchEvent(new Event("ns-bookmarks-change"));
  return true;
};

export const bookmarks = {
  list: read,
  has: (slug: string) => read().some(b => b.slug === slug),
  add: (b: Omit<BookmarkedPost, "saved_at">) => {
    const list = read().filter(x => x.slug !== b.slug);
    list.unshift({ ...b, saved_at: new Date().toISOString() });
    return write(list.slice(0, 200));
  },
  remove: (slug: string) => write(read().filter(b => b.slug !== slug)),
  toggle: (b: Omit<BookmarkedPost, "saved_at">): boolean =>
    bookmarks.has(b.slug) ? bookmarks.remove(b.slug) : bookmarks.add(b),
};
