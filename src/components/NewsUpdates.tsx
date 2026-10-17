import { Link } from "react-router-dom";
import { RSS_URL } from "@/lib/endpoints";

/** No mailing-list service is configured. Do not collect addresses or fake a signup. */
export function NewsUpdates() {
  return (
    <div>
      <p className="text-sm text-foreground/80 mb-4">Email subscriptions are not available yet. Follow the latest stories on the site{RSS_URL ? " or in your RSS reader" : ""}.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/category/breaking-news" className="btn-primary">Browse latest stories</Link>
        {RSS_URL && <a href={RSS_URL} className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">RSS feed</a>}
      </div>
    </div>
  );
}
