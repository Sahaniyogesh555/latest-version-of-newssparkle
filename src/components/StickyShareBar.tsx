import { useEffect, useState } from "react";
import { ShareBar } from "./ShareBar";

export function StickyShareBar({ url, title }: { url: string; title: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const article = document.querySelector("article[aria-labelledby='article-title']");
      const rect = article?.getBoundingClientRect();
      setVisible(Boolean(rect && rect.top < -100 && rect.bottom > window.innerHeight));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [url]);

  if (!visible) return null;
  // Only use the outer gutter on wide screens. Inline sharing remains available
  // on mobile/tablets; a fixed rail there covered the article's last words.
  return (
    <div className="hidden 2xl:block fixed right-4 top-1/2 -translate-y-1/2 z-30 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <ShareBar url={url} title={title} vertical />
    </div>
  );
}
