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

  const submit = (e: React.FormEvent) => {
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
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="p-1.5 text-headline hover:text-primary transition-colors"
      >
        <Search className="size-5" />
      </button>
      {open && (
        <div role="dialog" aria-label="Search" className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start justify-center pt-[14vh] px-4 animate-in fade-in duration-150">
          <button onClick={() => setOpen(false)} aria-label="Close search" className="absolute top-4 right-4 p-2 text-byline hover:text-foreground"><X className="size-5" /></button>
          <form onSubmit={submit} className="w-full max-w-xl">
            <label className="block kicker text-byline mb-3">Search NewsSparkle</label>
            <div className="flex items-center border-b-2 border-primary pb-2">
              <Search className="size-5 text-byline mr-3" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search stories, topics, people…"
                className="flex-1 bg-transparent outline-none text-xl font-serif placeholder:text-byline/60"
              />
            </div>
            <p className="mt-3 text-xs text-byline uppercase tracking-wider">Press Enter to search · Esc to close</p>
          </form>
        </div>
      )}
    </>
  );
}
