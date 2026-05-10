import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { PostCard } from "./PostCard";
import { CATEGORIES, formatDate } from "@/lib/site";
import { ArrowRight } from "lucide-react";

interface Props {
  categorySlug: string;
  posts: Post[];
}

export function CategoryBlock({ categorySlug, posts }: Props) {
  const cat = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat || posts.length === 0) return null;

  const catColor = `hsl(var(--${cat.color}))`;
  const featured = posts[0];
  const rest = posts.slice(1, 4);

  return (
    <section className="border-b border-rule">
      <div className="container-wide py-12 sm:py-16">
        <Link
          to={`/category/${cat.slug}`}
          className="flex items-center justify-between mb-8 group"
        >
          <div>
            <span className="kicker block mb-2" style={{ color: catColor }}>
              Section
            </span>
            <h2 className="headline-lg text-left group-hover:text-primary transition-colors">
              {cat.name}
            </h2>
          </div>
          <ArrowRight className="size-5 text-byline group-hover:text-primary transition-colors shrink-0" />
        </Link>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* Featured article */}
          <div className="lg:col-span-2">
            <PostCard post={featured} variant="hero" />
          </div>

          {/* Side articles */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {rest.map((post) => (
              <Link
                key={post.id}
                to={`/post/${post.slug}`}
                className="group flex gap-4 pb-6 border-b border-border last:border-0 last:pb-0 hover:no-underline"
              >
                {post.featured_image_url && (
                  <div className="w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50">
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="headline-compact group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-xs text-byline mt-1">
                    {formatDate(post.published_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
