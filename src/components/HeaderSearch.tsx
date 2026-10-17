import { useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const navigate = useNavigate();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setOpen(false);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Search" className="p-2 text-headline hover:text-primary transition-colors">
          <Search className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent
        aria-modal="true"
        className="top-6 translate-y-0 w-[calc(100vw_-_2rem)] max-w-xl max-h-[calc(100dvh_-_3rem)] overflow-y-auto rounded-3xl bg-card p-6 sm:top-10"
        onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
      >
        <DialogTitle className="kicker text-byline pr-6">Search NewsSparkle</DialogTitle>
        <form onSubmit={submit} className="space-y-4 min-w-0">
          <label htmlFor={inputId} className="sr-only">Search stories</label>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
            <Search className="size-5 shrink-0 text-byline" />
            <input ref={inputRef} id={inputId} type="search" name="q" required value={q} onChange={event => setQ(event.target.value)} placeholder="Stories, topics, people…" className="min-w-0 w-full bg-transparent text-base text-headline placeholder:text-byline/80 focus:outline-none" />
          </div>
          <button type="submit" className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Search</button>
        </form>
        <DialogDescription className="text-center text-xs text-byline">Press Enter to search · Esc to close</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
