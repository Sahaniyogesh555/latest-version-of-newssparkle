import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { PostCard } from "./PostCard";
import { CATEGORIES } from "@/lib/site";
import { ArrowRight } from "lucide-react";

interface Props {
  post: Post;
  posts: Post[];
}

export function RelatedArticles({ post, posts }: Props) {
  if (posts.length === 0) return null;

  const cat = CATEGORIES.find((c) => c.slug === post.category_slug);
  const mainRelated = posts.slice(0, 3);

  return (
    <section className="container-prose py-16 border-t border-rule">
      <div className="mb-10">
        <h2 className="headline-lg mb-3">More from {cat?.name || "the newsroom"}</h2>
        <p className="text-foreground/70">
          Related stories and in-depth analysis on this topic.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        {mainRelated.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      {posts.length > 3 && (
        <div className="mt-10 text-center">
          <Link
            to={`/category/${post.category_slug}`}
            className="inline-flex items-center gap-2 btn-primary"
          >
            Browse all {cat?.name.toLowerCase()}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
