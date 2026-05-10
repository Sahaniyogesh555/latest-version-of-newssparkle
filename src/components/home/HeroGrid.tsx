import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";

function Kicker({ slug }: { slug: string }) {
  const cat = CATEGORIES.find(c => c.slug === slug);
  return cat ? (
    <span className="kicker" style={{ color: `hsl(var(--${cat.color}))` }}>{cat.name}</span>
  ) : null;
}

export function HeroGrid({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;
  const [main, ...rest] = posts;
  const side = rest.slice(0, 2);
  const bottom = rest.slice(2, 5);

  return (
    <section className="container-wide py-8 sm:py-10">
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main */}
        <Link to={`/post/${main.slug}`} className="lg:col-span-2 group block">
          <article className="relative aspect-[16/10] lg:aspect-[16/9] overflow-hidden bg-muted">
            {main.featured_image_url && (
              <img src={main.featured_image_url} alt={main.featured_image_alt || main.title}
                loading="eager" fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 text-white">
              <Kicker slug={main.category_slug} />
              <h2 className="font-serif font-black tracking-tight mt-3 text-2xl sm:text-4xl lg:text-5xl leading-[1.1] group-hover:text-primary transition-colors">
                {main.title}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-white/85 line-clamp-2 max-w-2xl">{main.excerpt}</p>
              <div className="mt-3 text-[11px] uppercase tracking-wider text-white/70">
                {main.author} · {formatDate(main.published_at)} · {main.reading_minutes} min
              </div>
            </div>
          </article>
        </Link>

        {/* Side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          {side.map(p => (
            <Link key={p.id} to={`/post/${p.slug}`} className="group block">
              <article className="flex flex-col h-full">
                {p.featured_image_url && (
                  <div className="aspect-[16/10] overflow-hidden bg-muted mb-3">
                    <img src={p.featured_image_url} alt={p.featured_image_alt || p.title} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  </div>
                )}
                <Kicker slug={p.category_slug} />
                <h3 className="font-serif font-bold text-lg sm:text-xl leading-snug mt-1.5 group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
                <div className="mt-2 text-[11px] uppercase tracking-wider text-byline">
                  {formatDate(p.published_at)} · {p.reading_minutes} min
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom row of 3 secondary stories */}
      {bottom.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-6 mt-8 pt-8 border-t border-border">
          {bottom.map(p => (
            <Link key={p.id} to={`/post/${p.slug}`} className="group flex gap-3">
              {p.featured_image_url && (
                <div className="w-24 h-24 shrink-0 overflow-hidden bg-muted">
                  <img src={p.featured_image_url} alt={p.featured_image_alt || p.title} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="min-w-0">
                <Kicker slug={p.category_slug} />
                <h3 className="font-serif font-bold text-[15px] leading-snug mt-1 line-clamp-3 group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
