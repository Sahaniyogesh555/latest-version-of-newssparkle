import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { Clock } from "lucide-react";

const PAGE_SIZE = 9;

export function LatestFeed({ initial, excludeIds }: { initial: Post[]; excludeIds: Set<string> }) {
  const [posts, setPosts] = useState<Post[]>(initial);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = posts.length + excludeIds.size;
    const { data } = await supabase.from("posts").select("*").eq("status", "published")
      .order("published_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    const next = ((data as Post[]) || []).filter(p => !excludeIds.has(p.id));
    setPosts(prev => [...prev, ...next]);
    setHasMore(next.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [posts.length, loadingMore, hasMore, excludeIds]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: "600px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore, hasMore]);

  return (
    <section className="container-wide py-12 sm:py-16">
      <div className="flex items-center gap-2 mb-8 pb-3 border-b border-border">
        <Clock className="size-4 text-primary" />
        <h2 className="kicker text-headline">Latest Stories</h2>
        <span className="kicker text-byline ml-auto hidden sm:inline">Updated continuously</span>
      </div>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map(p => <PostCard key={p.id} post={p} />)}
      </div>
      <div ref={sentinelRef} aria-hidden className="h-10" />
      {loadingMore && (
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-muted" />)}
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="text-center text-byline text-xs uppercase tracking-wider mt-10">— End of feed —</p>
      )}
    </section>
  );
}
