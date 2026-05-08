import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { TrendingUp, Eye } from "lucide-react";
import { CATEGORIES } from "@/lib/site";

export function TrendingStrip({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;
  return (
    <section className="border-y border-border bg-secondary/40">
      <div className="container-wide py-10">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="kicker text-headline">Trending Now</h2>
          <span className="kicker text-byline ml-auto hidden sm:inline">Most read this week</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
          {posts.slice(0, 5).map((p, i) => {
            const cat = CATEGORIES.find(c => c.slug === p.category_slug);
            return (
              <Link key={p.id} to={`/post/${p.slug}`} className="group flex gap-3">
                <div className="font-serif font-black text-4xl leading-none text-primary/30 group-hover:text-primary transition-colors w-8 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  {cat && <span className="kicker" style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</span>}
                  <h3 className="font-serif font-bold text-[15px] leading-snug mt-1 line-clamp-3 group-hover:text-primary transition-colors">
                    {p.title}
                  </h3>
                  <div className="mt-1.5 text-[11px] text-byline flex items-center gap-1 uppercase tracking-wider">
                    <Eye className="size-3" /> {p.views.toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
