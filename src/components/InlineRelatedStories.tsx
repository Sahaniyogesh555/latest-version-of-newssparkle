import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { OptimizedImage } from "@/components/OptimizedImage";
import { formatDate } from "@/lib/site";
import { Clock } from "lucide-react";

interface InlineRelatedStoriesProps {
  posts: Post[];
  title?: string;
}

export function InlineRelatedStories({ posts, title = "Related Stories" }: InlineRelatedStoriesProps) {
  if (!posts.length) return null;

  return (
    <aside className="my-12 p-6 bg-secondary/30 border border-border rounded-lg">
      <h3 className="font-serif text-xl font-bold mb-6 text-headline border-b border-border pb-2">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/post/${post.slug}`}
            className="group block p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex gap-4">
              {post.featured_image_url && (
                <OptimizedImage
                  src={post.featured_image_url}
                  alt={post.title}
                  width={80}
                  height={60}
                  className="w-20 h-15 object-cover rounded-md flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-headline group-hover:text-primary transition-colors line-clamp-2 mb-1">
                  {post.title}
                </h4>
                <p className="text-sm text-byline line-clamp-2 mb-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-2 text-xs text-byline">
                  <time dateTime={post.published_at}>
                    {formatDate(post.published_at)}
                  </time>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {post.reading_minutes} min
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}