import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="p-1.5 text-headline hover:text-primary transition-colors"
      >
        <Search className="size-5" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Search"
          className="fixed inset-0 z-50 bg-background/98 backdrop-blur-sm overflow-auto"
        >
          <div className="flex min-h-screen items-start justify-center px-4 py-6 sm:py-10">
            <div className="relative w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-black/10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="absolute right-4 top-4 p-2 text-byline hover:text-foreground"
              >
                <X className="size-5" />
              </button>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block kicker text-byline mb-2">Search NewsSparkle</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
                    <Search className="size-5 text-byline" />
                    <input
                      ref={inputRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search stories, topics, people…"
                      className="w-full bg-transparent text-base font-serif text-foreground placeholder:text-byline/60 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Search
                </button>
                <p className="text-center text-xs text-byline uppercase tracking-wider">
                  Press Enter to search · Esc to close
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
