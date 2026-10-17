import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, ChevronRight, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function BreakingNewsTicker() {
  const [alerts, setAlerts] = useState<Array<{ slug: string; title: string }>>([]);
  const [paused, setPaused] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const { data, error } = await supabase.from("posts").select("slug, title").eq("status", "published")
          .order("published_at", { ascending: false }).limit(20).abortSignal(controller.signal);
        if (active && !error && data) setAlerts(data.filter(post => post.title && post.slug));
      } catch { /* The optional headlines rail must not break the page. */ }
    })();
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || alerts.length < 2) return;
    const interval = setInterval(() => setOffset(previous => (previous + 1) % alerts.length), 5000);
    return () => clearInterval(interval);
  }, [alerts.length, paused, hovered, focused]);

  if (!alerts.length) return null;
  return (
    <div className="bg-gradient-to-r from-destructive/10 to-destructive/5 border-b border-destructive/20">
      <div className="container-wide py-2.5 sm:py-3">
        <div className="flex items-center gap-3 sm:gap-4" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="size-4 sm:size-5 text-destructive" />
            {/* This query contains all recent stories, not only breaking-news alerts. */}
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-destructive">Latest</span>
          </div>
          <Link to={`/post/${alerts[offset]?.slug || ""}`} className="min-w-0 flex-1 truncate text-sm sm:text-base font-medium text-headline hover:text-primary transition-colors">{alerts[offset]?.title}</Link>
          <ChevronRight className="size-4 text-byline shrink-0" />
          {alerts.length > 1 && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Resume headlines" : "Pause headlines"} aria-pressed={paused} className="inline-flex size-8 shrink-0 items-center justify-center rounded border border-border text-byline hover:text-primary">
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>}
        </div>
      </div>
    </div>
  );
}
