import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Post } from "@/lib/types";
import { Zap, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function BreakingNewsTicker() {
  const [alerts, setAlerts] = useState<Array<{ slug: string; title: string }>>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("posts")
        .select("slug, title")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(20);
      if (data) {
        setAlerts(
          (data as Array<{ slug: string; title: string }>).filter(
            (p) => p.title && p.slug
          )
        );
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    if (isPaused || alerts.length === 0) return;
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % alerts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [alerts.length, isPaused]);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 border-b border-destructive/20">
      <div className="container-wide py-2.5 sm:py-3">
        <div
          className="flex items-center gap-3 sm:gap-4 cursor-pointer"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="size-4 sm:size-5 text-destructive animate-pulse" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-destructive">
              Breaking
            </span>
          </div>
          <Link
            to={`/post/${alerts[offset]?.slug || ""}`}
            className="flex-1 truncate text-sm sm:text-base font-medium text-headline hover:text-primary transition-colors"
          >
            {alerts[offset]?.title}
          </Link>
          <ChevronRight className="size-4 text-byline shrink-0" />
        </div>
      </div>
    </div>
  );
}
