import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { CATEGORIES, formatDate } from "@/lib/site";
import { TrendingUp } from "lucide-react";

interface Props {
  posts: Post[];
}

export function TrendingSection({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <section className="border-y border-border bg-muted/40">
      <div className="container-wide py-12 sm:py-16">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="size-5 text-primary" />
          <span className="kicker text-primary">Trending now</span>
        </div>
        <h2 className="headline-lg mb-10">Most read right now</h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {posts.slice(0, 4).map((post, i) => {
            const cat = CATEGORIES.find((c) => c.slug === post.category_slug);
            const catColor = cat
              ? `hsl(var(--${cat.color}))`
              : "hsl(var(--primary))";

            return (
              <Link
                key={post.id}
                to={`/post/${post.slug}`}
                className="group flex flex-col card-base p-4 hover:shadow-elevated transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-serif text-2xl font-black text-byline/30">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                {cat && (
                  <span
                    className="kicker block mb-2"
                    style={{ color: catColor }}
                  >
                    {cat.name}
                  </span>
                )}
                <h3 className="headline-card group-hover:text-primary transition-colors line-clamp-2 flex-1">
                  {post.title}
                </h3>
                <div className="text-xs text-byline mt-3 flex items-center justify-between">
                  <span>{formatDate(post.published_at)}</span>
                  <span>{post.reading_minutes} min</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
