import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { Radio } from "lucide-react";

export function BreakingTicker({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;
  const items = [...posts, ...posts]; // duplicate for seamless loop
  return (
    <div className="border-b border-border bg-foreground text-background">
      <div className="container-wide flex items-stretch gap-0 h-10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 bg-primary text-primary-foreground font-bold text-[11px] uppercase tracking-[0.14em] shrink-0">
          <Radio className="size-3.5 animate-pulse" /> Live
        </div>
        <div className="relative flex-1 overflow-hidden group">
          <div className="absolute whitespace-nowrap flex items-center h-full animate-[ticker_60s_linear_infinite] group-hover:[animation-play-state:paused]">
            {items.map((p, i) => (
              <Link key={`${p.id}-${i}`} to={`/post/${p.slug}`}
                className="px-6 text-sm font-medium hover:text-primary transition-colors flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
