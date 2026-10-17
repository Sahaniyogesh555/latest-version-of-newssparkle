import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { BookmarkButton } from "./BookmarkButton";
import { findAuthor } from "@/lib/authors";
import { OptimizedImage } from "@/components/OptimizedImage";
import { AuthorImage } from "@/components/AuthorImage";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, CheckCircle, RefreshCw } from "lucide-react";

interface Props { post: Post; variant?: "hero" | "lead" | "default" | "compact" }

export function PostCard({ post, variant = "default" }: Props) {
  const cat = CATEGORIES.find(c => c.slug === post.category_slug);
  const catColor = cat ? `hsl(var(--${cat.color}))` : "hsl(var(--primary))";
  const authorProfile = findAuthor(post.author);
  const wasUpdated = post.updated_at && post.updated_at !== post.published_at;
  const hero = variant === "hero";

  if (variant === "compact") {
    return (
      <Link to={`/post/${post.slug}`} className="group block py-4 border-b border-border last:border-0">
        <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
        <h3 className="font-serif text-base font-bold leading-snug mt-1 group-hover:text-primary transition-colors">{post.title}</h3>
        <div className="text-[11px] text-byline mt-1.5 uppercase tracking-wider">{formatDate(post.published_at)}</div>
      </Link>
    );
  }

  const Heading = hero ? "h2" : "h3";
  return (
    <article className={`group relative min-w-0 hover-lift ${hero ? "grid lg:grid-cols-2 gap-6 lg:gap-10 items-center" : "card-base p-4 border border-border bg-card shadow-sm hover:shadow-lg transition-all duration-300"}`}>
      {post.featured_image_url && (
        <div className={`aspect-16/9 overflow-hidden bg-muted rounded-lg ${hero ? "" : "mb-4"}`}>
          <OptimizedImage src={post.featured_image_url} alt={post.featured_image_alt || post.title} loading={hero ? "eager" : "lazy"} priority={hero} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="badge-verified text-xs"><CheckCircle className="size-3 mr-1" />Verified</Badge>
            {wasUpdated && <Badge variant="outline" className="badge-updated text-xs"><RefreshCw className="size-3 mr-1" />Updated</Badge>}
          </div>
        </div>
        <Heading className={`${hero ? "headline-hero mt-3" : "headline-card mt-2"} group-hover:text-primary transition-colors duration-300`}>
          {/* The heading link stretches over the card; the bookmark is a sibling,
              above that hit area, not an invalid button nested inside an anchor. */}
          <Link to={`/post/${post.slug}`} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">{post.title}</Link>
        </Heading>
        <p className={hero ? "mt-4 text-lg text-foreground/80 leading-relaxed" : "mt-2 text-sm text-foreground/75 leading-relaxed line-clamp-3"}>{post.excerpt}</p>
        <div className={`${hero ? "mt-5" : "mt-4"} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-2">
            <AuthorImage author={authorProfile} size="sm" ring={false} />
            <div className="min-w-0">
              <div className={`${hero ? "text-sm" : "text-xs"} font-medium text-foreground`}>{authorProfile.name}</div>
              <div className="text-[10px] text-byline flex flex-wrap items-center gap-1 mt-1">
                <Badge variant="outline" className="badge-expert text-[10px] px-1 py-0">{authorProfile.role}</Badge>
                <span>·</span><time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-byline">
            <span className="flex items-center gap-1"><Clock className="size-3" />{post.reading_minutes} min</span>
            <span className="flex items-center gap-1"><Eye className="size-3" />{post.views || 0}</span>
            <BookmarkButton post={post} size="sm" />
          </div>
        </div>
      </div>
    </article>
  );
}
