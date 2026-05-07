import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { BookmarkButton } from "./BookmarkButton";

interface Props { post: Post; variant?: "hero" | "lead" | "default" | "compact" }

export function PostCard({ post, variant = "default" }: Props) {
  const cat = CATEGORIES.find(c => c.slug === post.category_slug);
  const catColor = cat ? `hsl(var(--${cat.color}))` : "hsl(var(--primary))";

  if (variant === "hero") {
    return (
      <Link to={`/post/${post.slug}`} className="group block">
        <article className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          {post.featured_image_url && (
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img src={post.featured_image_url} alt={post.featured_image_alt || post.title} loading="eager"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" />
            </div>
          )}
          <div>
            <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
            <h2 className="headline-hero mt-3 group-hover:text-primary transition-colors">{post.title}</h2>
            <p className="mt-4 text-lg text-foreground/80 leading-relaxed">{post.excerpt}</p>
            <div className="mt-5 text-xs text-byline uppercase tracking-wider">
              {post.author} · {formatDate(post.published_at)} · {post.reading_minutes} min read
            </div>
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link to={`/post/${post.slug}`} className="group block py-4 border-b border-border last:border-0">
        <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
        <h3 className="font-serif text-base font-bold leading-snug mt-1 group-hover:text-primary transition-colors">{post.title}</h3>
        <div className="text-[11px] text-byline mt-1.5 uppercase tracking-wider">{formatDate(post.published_at)}</div>
      </Link>
    );
  }

  return (
    <Link to={`/post/${post.slug}`} className="group block">
      <article>
        {post.featured_image_url && (
          <div className="aspect-[16/10] overflow-hidden bg-muted mb-4">
            <img src={post.featured_image_url} alt={post.featured_image_alt || post.title} loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          </div>
        )}
        <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
        <h3 className="headline-card mt-2 group-hover:text-primary transition-colors">{post.title}</h3>
        <p className="mt-2 text-sm text-foreground/75 leading-relaxed line-clamp-3">{post.excerpt}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-byline uppercase tracking-wider">
          <span>{formatDate(post.published_at)} · {post.reading_minutes} min</span>
          <BookmarkButton size="sm" post={{ slug: post.slug, title: post.title, excerpt: post.excerpt, category_slug: post.category_slug, featured_image_url: post.featured_image_url, published_at: post.published_at }} />
        </div>
      </article>
    </Link>
  );
}
