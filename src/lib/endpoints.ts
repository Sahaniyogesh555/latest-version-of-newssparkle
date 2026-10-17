/** Public feed URLs use the configured API host, not the frontend SPA host. */
export function feedUrl(base: string | undefined, name: "rss"): string | undefined {
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return `${base.replace(/\/+$/, "")}/functions/v1/${name}`;
  } catch {
    return undefined;
  }
}

export const RSS_URL = feedUrl(import.meta.env.VITE_SUPABASE_URL, "rss");
