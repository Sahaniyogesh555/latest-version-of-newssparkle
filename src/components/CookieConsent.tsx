import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readStorage, writeStorage } from "@/lib/storage";

const STORAGE_KEY = "ns-cookie-consent";

type Choice = "accepted" | "rejected";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const existing = JSON.parse(readStorage(STORAGE_KEY) || "null");
      setVisible(existing?.choice !== "accepted" && existing?.choice !== "rejected");
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (choice: Choice) => {
    writeStorage(STORAGE_KEY, JSON.stringify({ choice, ts: new Date().toISOString() }));
    setVisible(false);
    // Signal to ad/analytics scripts that consent state changed
    window.dispatchEvent(new CustomEvent("ns:consent", { detail: { choice } }));
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur shadow-[0_-8px_24px_-12px_hsl(var(--foreground)/0.15)]"
    >
      <div className="container-wide py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-foreground/80 flex-1 leading-relaxed">
          We use cookies to analyse traffic and personalise advertising. By accepting, you allow
          us and partners (including Google AdSense) to set cookies for these purposes. See our{" "}
          <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => decide("rejected")}
            className="px-4 py-2 text-sm font-medium border border-border hover:border-primary hover:text-primary transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => decide("accepted")}
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
