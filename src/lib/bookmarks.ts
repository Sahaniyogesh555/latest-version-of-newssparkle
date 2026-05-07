// Lightweight bookmarks store using localStorage. Survives reloads, no auth needed.
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

const read = (): BookmarkedPost[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const write = (list: BookmarkedPost[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("ns-bookmarks-change"));
};

export const bookmarks = {
  list: read,
  has: (slug: string) => read().some(b => b.slug === slug),
  add: (b: Omit<BookmarkedPost, "saved_at">) => {
    const list = read().filter(x => x.slug !== b.slug);
    list.unshift({ ...b, saved_at: new Date().toISOString() });
    write(list.slice(0, 200));
  },
  remove: (slug: string) => write(read().filter(b => b.slug !== slug)),
  toggle: (b: Omit<BookmarkedPost, "saved_at">) => {
    if (bookmarks.has(b.slug)) bookmarks.remove(b.slug);
    else bookmarks.add(b);
  },
};
