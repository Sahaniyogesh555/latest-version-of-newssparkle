import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { OptimizedImage } from "./OptimizedImage";

interface Props {
  featured: Post;
  secondary: Post[];
}

export function HeroFeaturedGrid({ featured, secondary }: Props) {
  const cat = CATEGORIES.find(c => c.slug === featured.category_slug);
  const catColor = cat ? `hsl(var(--${cat.color}))` : "hsl(var(--primary))";

  return (
    <section className="container-wide py-12 sm:py-16">
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-10 items-stretch">
        <Link to={`/post/${featured.slug}`} className="group block min-w-0 lg:col-span-2">
          <article className="flex h-full flex-col">
            {featured.featured_image_url && (
              <div className="aspect-video overflow-hidden bg-muted mb-6 rounded-lg border border-border">
                <OptimizedImage src={featured.featured_image_url} alt={featured.featured_image_alt || featured.title} loading="eager" priority className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
              </div>
            )}
            <div className="flex-1 flex flex-col">
              <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
              <h2 className="headline-hero mt-3 group-hover:text-primary transition-colors text-left">{featured.title}</h2>
              <p className="mt-4 text-lg text-foreground/80 leading-relaxed text-left line-clamp-3">{featured.excerpt}</p>
              <div className="mt-auto pt-6 flex flex-wrap items-center gap-3 text-sm text-byline uppercase tracking-wider">
                <span>{formatDate(featured.published_at)}</span><span>•</span><span>{featured.reading_minutes} min read</span>
              </div>
            </div>
          </article>
        </Link>
        <div className="min-w-0 lg:col-span-1 flex flex-col gap-6">
          {secondary.slice(0, 3).map((post, index) => (
            <Link key={post.id} to={`/post/${post.slug}`} className="group flex flex-col border-b border-border pb-6 last:border-0 last:pb-0 hover:no-underline">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">{index + 1}</span>
              <h3 className="headline-compact mt-2 group-hover:text-primary transition-colors line-clamp-3">{post.title}</h3>
              <span className="text-xs text-byline mt-2">{formatDate(post.published_at)}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="my-12 border-t border-rule" />
    </section>
  );
}
