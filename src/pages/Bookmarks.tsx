import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { bookmarks, BookmarkedPost } from "@/lib/bookmarks";
import { CATEGORIES, formatDate } from "@/lib/site";
import { Trash2, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

export default function Bookmarks() {
  const [list, setList] = useState<BookmarkedPost[]>([]);

  useEffect(() => {
    const refresh = () => setList(bookmarks.list());
    refresh();
    window.addEventListener("ns-bookmarks-change", refresh);
    return () => window.removeEventListener("ns-bookmarks-change", refresh);
  }, []);

  return (
    <Layout>
      <SEO
        title="Your Saved Articles"
        description="Articles you've saved to read later on NewsSparkle."
        path="/bookmarks"
        robots="noindex, follow"
      />
      <div className="container-wide py-12">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Bookmarks</span>
        </nav>
        <div className="flex items-baseline justify-between border-b border-rule pb-4 mb-8">
          <h1 className="font-serif text-4xl font-black text-headline flex items-center gap-3">
            <BookmarkCheck className="size-8 text-primary" /> Saved
          </h1>
          <span className="kicker text-byline">{list.length} item{list.length === 1 ? "" : "s"}</span>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-byline">No saved articles yet.</p>
            <p className="mt-2 text-sm text-byline">Tap the bookmark icon on any article to save it for later.</p>
            <Link to="/" className="mt-6 inline-block px-5 py-2.5 border border-border hover:border-primary hover:text-primary text-sm uppercase tracking-wider">Browse stories</Link>
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {list.map(b => {
              const cat = CATEGORIES.find(c => c.slug === b.category_slug);
              return (
                <li key={b.slug} className="py-5 flex gap-5 items-start">
                  {b.featured_image_url && (
                    <Link to={`/post/${encodeURIComponent(b.slug)}`} className="shrink-0" aria-label={`Read ${b.title}`}>
                      <img src={b.featured_image_url} alt="" loading="lazy" decoding="async" className="w-28 sm:w-40 aspect-[16/10] object-cover bg-muted" />
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    {cat && <span className="kicker" style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</span>}
                    <Link to={`/post/${encodeURIComponent(b.slug)}`} className="block font-serif text-lg sm:text-xl font-bold text-headline mt-1 hover:text-primary transition-colors">{b.title}</Link>
                    <p className="mt-1 text-sm text-foreground/75 line-clamp-2">{b.excerpt}</p>
                    <div className="mt-2 text-[11px] text-byline uppercase tracking-wider">Saved {formatDate(b.saved_at)}</div>
                  </div>
                  <button onClick={() => { if (!bookmarks.remove(b.slug)) toast.error("Could not remove this bookmark. Browser storage is unavailable or full."); }} aria-label={`Remove ${b.title}`} className="text-byline hover:text-destructive p-1.5"><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}
