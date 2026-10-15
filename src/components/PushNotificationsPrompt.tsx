import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

const KEY = "ns_push_prompt_v1";

export function PushNotificationsPrompt() {
  const [show, setShow] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (remember = true) => {
    if (remember) localStorage.setItem(KEY, "dismissed");
    setShow(false);
  };

  const enable = async () => {
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") {
        setGranted(true);
        new Notification("Breaking news alerts on", {
          body: "We'll only ping you for major breaking stories.",
          icon: "/icon-192.png",
        });
      }
    } catch { /* ignore */ }
    localStorage.setItem(KEY, "answered");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Enable breaking-news notifications"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 bg-card border border-border shadow-elevated rounded-md p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <button
        onClick={() => dismiss()}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-byline hover:text-foreground p-1"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3">
        <div className="shrink-0 size-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="size-5 text-primary" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="font-serif font-bold text-headline">Breaking news alerts</h3>
          <p className="text-sm text-foreground/75 mt-1">
            Get notified for major breaking stories and trending updates. No spam.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={enable}
              disabled={granted}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors rounded"
            >
              Enable
            </button>
            <button
              onClick={() => dismiss()}
              className="px-3.5 py-1.5 text-sm text-byline hover:text-foreground transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
