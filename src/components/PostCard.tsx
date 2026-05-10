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

  if (variant === "hero") {
    return (
      <Link to={`/post/${post.slug}`} className="group block hover-lift">
        <article className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          {post.featured_image_url && (
            <div className="aspect-16/9 overflow-hidden bg-muted rounded-lg">
              <OptimizedImage
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                loading="eager"
                priority
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="badge-verified text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
                {wasUpdated && (
                  <Badge variant="outline" className="badge-updated text-xs">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Updated
                  </Badge>
                )}
              </div>
            </div>
            <h2 className="headline-hero mt-3 group-hover:text-primary transition-colors duration-300">{post.title}</h2>
            <p className="mt-4 text-lg text-foreground/80 leading-relaxed">{post.excerpt}</p>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AuthorImage
                  author={authorProfile}
                  size="sm"
                  ring={false}
                />
                <div>
                  <div className="text-sm font-medium text-foreground">{authorProfile.name}</div>
                  <div className="text-xs text-byline uppercase tracking-wider flex items-center gap-2">
                    <Badge variant="outline" className="badge-expert text-xs">
                      {authorProfile.role}
                    </Badge>
                    <span>·</span>
                    <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-byline">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {post.reading_minutes} min
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {post.views || 0}
                </div>
                <BookmarkButton post={post} size="sm" />
              </div>
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
    <Link to={`/post/${post.slug}`} className="group block hover-lift">
      <article className="card-base p-4 hover:shadow-lg transition-all duration-300">
        {post.featured_image_url && (
          <div className="aspect-16/9 overflow-hidden bg-muted rounded-lg mb-4">
            <OptimizedImage
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="kicker" style={{ color: catColor }}>{cat?.name}</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="badge-verified text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Verified
            </Badge>
            {wasUpdated && (
              <Badge variant="outline" className="badge-updated text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Updated
              </Badge>
            )}
          </div>
        </div>
        <h3 className="headline-card mt-2 group-hover:text-primary transition-colors duration-300">{post.title}</h3>
        <p className="mt-2 text-sm text-foreground/75 leading-relaxed line-clamp-3">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AuthorImage
              author={authorProfile}
              size="sm"
              ring={false}
              className="w-5 h-5"
            />
            <div>
              <div className="text-xs font-medium text-foreground">{authorProfile.name}</div>
              <div className="text-[10px] text-byline flex items-center gap-1">
                <Badge variant="outline" className="badge-expert text-[10px] px-1 py-0">
                  {authorProfile.role}
                </Badge>
                <span>·</span>
                <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-byline">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.reading_minutes}m
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.views || 0}
            </div>
            <BookmarkButton post={post} size="sm" />
          </div>
        </div>
      </article>
    </Link>
  );
}
