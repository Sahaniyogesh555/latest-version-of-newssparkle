import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { Star } from "lucide-react";

export function EditorsPicks({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;
  return (
    <section className="bg-foreground text-background">
      <div className="container-wide py-14">
        <div className="flex items-center gap-2 mb-8">
          <Star className="size-4 text-primary fill-primary" />
          <h2 className="kicker text-background">Editor's Picks</h2>
          <span className="kicker text-background/60 ml-auto hidden sm:inline">Hand-curated reads</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {posts.slice(0, 4).map(p => {
            const cat = CATEGORIES.find(c => c.slug === p.category_slug);
            return (
              <Link key={p.id} to={`/post/${p.slug}`} className="group block">
                <article>
                  {p.featured_image_url && (
                    <div className="aspect-[4/3] overflow-hidden bg-muted/20 mb-3">
                      <img src={p.featured_image_url} alt={p.featured_image_alt || p.title} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                    </div>
                  )}
                  {cat && (
                    <span className="kicker" style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</span>
                  )}
                  <h3 className="font-serif font-bold text-lg leading-snug mt-1.5 line-clamp-3 group-hover:text-primary transition-colors">
                    {p.title}
                  </h3>
                  <div className="mt-2 text-[11px] uppercase tracking-wider text-background/60">
                    {formatDate(p.published_at)}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
