import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { OptimizedImage } from "@/components/OptimizedImage";
import { formatDate } from "@/lib/site";
import { Clock, BookOpen } from "lucide-react";

export function ContinueReading() {
  const [continueReading, setContinueReading] = useState<Post | null>(null);

  useEffect(() => {
    // Get the last viewed post from localStorage or a similar mechanism
    const lastViewed = localStorage.getItem('lastViewedPost');
    if (lastViewed) {
      const fetchPost = async () => {
        const { data } = await supabase
          .from("posts")
          .select("*")
          .eq("slug", lastViewed)
          .eq("status", "published")
          .single();

        if (data) setContinueReading(data as Post);
      };
      fetchPost();
    }
  }, []);

  if (!continueReading) return null;

  return (
    <section className="bg-card border border-border rounded-lg p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="size-5 text-primary" />
        <h3 className="font-semibold text-headline">Continue Reading</h3>
      </div>

      <Link
        to={`/post/${continueReading.slug}`}
        className="group block hover:no-underline"
      >
        <div className="flex gap-4">
          {continueReading.featured_image_url && (
            <OptimizedImage
              src={continueReading.featured_image_url}
              alt={continueReading.title}
              width={100}
              height={60}
              className="w-25 h-15 object-cover rounded-md flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-headline group-hover:text-primary transition-colors line-clamp-2 mb-2">
              {continueReading.title}
            </h4>
            <div className="flex items-center gap-3 text-sm text-byline">
              <time dateTime={continueReading.published_at}>
                {formatDate(continueReading.published_at)}
              </time>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {continueReading.reading_minutes} min
              </span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}