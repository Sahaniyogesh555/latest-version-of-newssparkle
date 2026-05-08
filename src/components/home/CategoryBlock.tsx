import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { ArrowRight } from "lucide-react";

export function CategoryBlock({ slug, posts }: { slug: string; posts: Post[] }) {
  const cat = CATEGORIES.find(c => c.slug === slug);
  if (!cat || posts.length === 0) return null;
  const [feature, ...side] = posts;
  const color = `hsl(var(--${cat.color}))`;

  return (
    <section className="container-wide py-12">
      <div className="flex items-end justify-between mb-6 pb-3 border-b-2" style={{ borderColor: color }}>
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full" style={{ background: color }} />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-headline">{cat.name}</h2>
        </div>
        <Link to={`/category/${cat.slug}`}
          className="text-[12px] font-semibold uppercase tracking-wider text-byline hover:text-primary flex items-center gap-1">
          More <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Featured */}
        <Link to={`/post/${feature.slug}`} className="lg:col-span-3 group block">
          <article>
            {feature.featured_image_url && (
              <div className="aspect-[16/10] overflow-hidden bg-muted mb-4">
                <img src={feature.featured_image_url} alt={feature.featured_image_alt || feature.title} loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" />
              </div>
            )}
            <h3 className="font-serif font-bold text-xl sm:text-2xl lg:text-3xl leading-tight group-hover:text-primary transition-colors">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm sm:text-base text-foreground/75 line-clamp-2">{feature.excerpt}</p>
            <div className="mt-3 text-[11px] uppercase tracking-wider text-byline">
              {feature.author} · {formatDate(feature.published_at)} · {feature.reading_minutes} min
            </div>
          </article>
        </Link>

        {/* Side list */}
        <div className="lg:col-span-2 divide-y divide-border">
          {side.slice(0, 4).map(p => (
            <Link key={p.id} to={`/post/${p.slug}`} className="group flex gap-3 py-3 first:pt-0">
              {p.featured_image_url && (
                <div className="w-20 h-20 shrink-0 overflow-hidden bg-muted">
                  <img src={p.featured_image_url} alt={p.featured_image_alt || p.title} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-serif font-semibold text-[15px] leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                  {p.title}
                </h4>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-byline">
                  {formatDate(p.published_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
