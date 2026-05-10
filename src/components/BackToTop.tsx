import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-20 left-4 md:bottom-4 z-40 size-10 rounded-full bg-card border border-border text-foreground shadow-elevated hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors flex items-center justify-center"
    >
      <ArrowUp className="size-4" />
    </button>
  );
}
