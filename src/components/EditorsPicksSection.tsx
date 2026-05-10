import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { PostCard } from "./PostCard";
import { Star } from "lucide-react";

interface Props {
  posts: Post[];
}

export function EditorsPicksSection({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <section>
      <div className="container-wide py-12 sm:py-16">
        <div className="flex items-center gap-2 mb-6">
          <Star className="size-5 text-primary fill-primary" />
          <span className="kicker text-primary">Curated</span>
        </div>
        <h2 className="headline-lg mb-10">Editor's picks</h2>
        <p className="text-lg text-foreground/70 mb-10 max-w-2xl">
          Stories we think you shouldn't miss, handpicked by our editorial team.
        </p>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 6).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
