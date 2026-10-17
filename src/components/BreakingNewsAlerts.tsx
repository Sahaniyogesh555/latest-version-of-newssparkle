import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, Zap, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { readStorage, writeStorage } from "@/lib/storage";

type AlertRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  image_url: string | null;
  category_slug: string | null;
  kind: "breaking" | "trending";
  created_at: string;
  expires_at: string;
};

const SEEN_KEY = "ns_alert_seen_v1";

function getSeen(): Set<string> {
  try {
    const stored: unknown = JSON.parse(readStorage(SEEN_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}
function markSeen(id: string) {
  const s = getSeen();
  s.add(id);
  // Keep last 200
  const arr = Array.from(s).slice(-200);
  writeStorage(SEEN_KEY, JSON.stringify(arr));
}

function fireBrowserNotification(a: AlertRow) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(
      a.kind === "breaking" ? `🚨 Breaking: ${a.title}` : `🔥 Trending: ${a.title}`,
      {
        body: a.excerpt ?? "",
        icon: a.image_url ?? "/icon-192.png",
        badge: "/icon-192.png",
        tag: `news-${a.id}`,
      },
    );
    n.onclick = () => {
      window.focus();
      window.location.href = `/post/${a.slug}`;
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function BreakingNewsAlerts() {
  const [active, setActive] = useState<AlertRow | null>(null);
  const seenRef = useRef<Set<string>>(getSeen());

  useEffect(() => {
    let mounted = true;

    // Load most recent active alert (so users arriving on the site see it once)
    (async () => {
      try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (!mounted) return;
      const a = data?.[0] as AlertRow | undefined;
      if (a && !seenRef.current.has(a.id)) {
        setActive(a);
      }
      } catch (error) {
        if (mounted) console.warn("[alerts] Notifications unavailable:", error);
      }
    })();

    const channel = supabase
      .channel("notifications-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const a = payload.new as AlertRow;
          if (seenRef.current.has(a.id)) return;
          fireBrowserNotification(a);
          setActive(a);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!active) return null;

  const dismiss = () => {
    markSeen(active.id);
    seenRef.current.add(active.id);
    setActive(null);
  };

  const isBreaking = active.kind === "breaking";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:top-4 sm:max-w-md z-[60] bg-card border border-border shadow-elevated rounded-md p-3 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss alert"
        className="absolute top-1.5 right-1.5 text-byline hover:text-foreground p-1"
      >
        <X className="size-4" />
      </button>
      <Link
        to={`/post/${active.slug}`}
        onClick={dismiss}
        className="flex gap-3 pr-5 items-start"
      >
        <div
          className={`shrink-0 size-10 rounded-full flex items-center justify-center ${
            isBreaking ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
          }`}
        >
          {isBreaking ? <Zap className="size-5" /> : <TrendingUp className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isBreaking
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {isBreaking ? "Breaking" : "Trending"}
            </span>
            <Bell className="size-3 text-byline" />
          </div>
          <h3 className="font-serif font-bold text-headline text-sm mt-1 line-clamp-2">
            {active.title}
          </h3>
          {active.excerpt && (
            <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{active.excerpt}</p>
          )}
        </div>
      </Link>
    </div>
  );
}
