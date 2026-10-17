import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { readStorage, writeStorage } from "@/lib/storage";

const KEY = "ns_push_prompt_v1";

export function PushNotificationsPrompt() {
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (!("Notification" in window) || Notification.permission !== "default" || readStorage(KEY)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setShow(true), 8000);
    };
    // Do not stack a second prompt on top of the first-visit consent controls.
    try {
      const consent = JSON.parse(readStorage("ns-cookie-consent") || "null");
      if (consent?.choice === "accepted" || consent?.choice === "rejected") schedule();
    } catch { /* Wait for a valid consent decision. */ }
    window.addEventListener("ns:consent", schedule);
    return () => { clearTimeout(timer); window.removeEventListener("ns:consent", schedule); };
  }, []);

  const dismiss = () => {
    writeStorage(KEY, "dismissed");
    setShow(false);
  };

  const enable = async () => {
    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Notifications allowed. News alerts can appear while this site is open.");
      } else if (permission === "denied") {
        toast.info("Notifications are blocked in your browser. You can still read alerts on the site.");
      }
      writeStorage(KEY, "answered");
      setShow(false);
    } catch {
      toast.error("Notifications are unavailable in this browser. You can still read alerts on the site.");
    } finally {
      setRequesting(false);
    }
  };

  if (!show) return null;

  return (
    <div role="dialog" aria-label="Enable news notifications" aria-describedby="notification-help" className="fixed bottom-[calc(6rem_+_env(safe-area-inset-bottom))] right-4 left-4 md:bottom-4 sm:left-auto sm:max-w-sm z-50 bg-card border border-border shadow-elevated rounded-md p-4">
      <button type="button" onClick={dismiss} aria-label="Dismiss notifications prompt" className="absolute top-2 right-2 text-byline hover:text-foreground p-2"><X className="size-4" /></button>
      <div className="flex gap-3">
        <div className="shrink-0 size-10 rounded-full bg-primary/10 flex items-center justify-center"><Bell className="size-5 text-primary" /></div>
        <div className="flex-1 min-w-0 pr-5">
          <h3 className="font-serif font-bold text-headline">News alerts while you read</h3>
          <p id="notification-help" className="text-sm text-foreground/75 mt-1">Allow browser notifications while NewsSparkle is open. Background push notifications are not available.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={enable} disabled={requesting} className="px-3.5 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors rounded disabled:opacity-60">{requesting ? "Requesting…" : "Enable"}</button>
            <button type="button" onClick={dismiss} className="px-3.5 py-2 text-sm text-byline hover:text-foreground transition-colors">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
