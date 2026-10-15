import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { POST_CARD_COLUMNS, normalizePosts } from "@/lib/posts";
import { OptimizedImage } from "@/components/OptimizedImage";
import { formatDate } from "@/lib/site";
import { TrendingUp } from "lucide-react";

export function TrendingSidebar() {
  const [trending, setTrending] = useState<Post[]>([]);

  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await supabase
        .from("posts")
        .select(POST_CARD_COLUMNS)
        .eq("status", "published")
        .order("views", { ascending: false })
        .limit(5);

      if (data) setTrending(normalizePosts(data));
    };

    fetchTrending();
  }, []);

  if (!trending.length) return null;

  return (
    <aside className="bg-card border border-border rounded-lg p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-primary" />
        <h3 className="font-semibold text-headline text-sm uppercase tracking-wider">
          Trending Now
        </h3>
      </div>

      <div className="space-y-4">
        {trending.map((post, index) => (
          <Link
            key={post.id}
            to={`/post/${post.slug}`}
            className="group block hover:no-underline"
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-headline group-hover:text-primary transition-colors line-clamp-2 text-sm leading-tight mb-1">
                  {post.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-byline">
                  <time dateTime={post.published_at}>
                    {formatDate(post.published_at)}
                  </time>
                  <span>{post.views} views</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link
        to="/trending"
        className="inline-block mt-4 text-xs text-primary hover:text-primary/80 font-medium uppercase tracking-wider"
      >
        View All Trending →
      </Link>
    </aside>
  );
}