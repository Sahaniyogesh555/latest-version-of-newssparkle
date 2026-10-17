/**
 * Anonymous, stable-per-browser visitor id.
 *
 * Used only to de-duplicate view counting on the server
 * (public.increment_post_views(slug, visitor_id) records one row per visitor
 * per article per day). It carries no personal data and is never sent anywhere
 * except to our own view-counting RPC.
 */
const KEY = "ns_visitor_id_v1";

export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length < 8) {
      id =
        (crypto.randomUUID?.() as string | undefined) ??
        `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled — count the view, skip de-duplication.
    return null;
  }
}
