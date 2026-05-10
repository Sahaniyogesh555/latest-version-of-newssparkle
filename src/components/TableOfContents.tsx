import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Heading {
  level: number;
  text: string;
  id: string;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    // Extract headings from article
    const article = document.querySelector("article");
    if (!article) return;

    const headingElements = article.querySelectorAll("h2, h3");
    const extracted: Heading[] = [];

    headingElements.forEach((el, idx) => {
      const level = parseInt(el.tagName[1]);
      let id = el.id;
      if (!id) {
        id = `heading-${idx}`;
        el.id = id;
      }
      extracted.push({
        level,
        text: el.textContent || "",
        id,
      });
    });

    setHeadings(extracted);
  }, []);

  useEffect(() => {
    // Track active heading
    const handleScroll = () => {
      const headingElements = headings.map((h) =>
        document.getElementById(h.id)
      );
      const current = headingElements.find((el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top > 0 && rect.top < window.innerHeight / 2;
      });
      if (current) setActiveId(current.id);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="lg:sticky lg:top-24 bg-card border border-border rounded-lg p-4 sm:p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left font-semibold text-headline hover:text-primary transition-colors"
      >
        <span className="text-sm font-bold uppercase tracking-wider text-byline">
          Contents
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <nav className="mt-4 space-y-2 text-sm">
          {headings.map((heading) => (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              className={`block px-3 py-1.5 rounded transition-all ${
                heading.level === 3 ? "pl-6" : ""
              } ${
                activeId === heading.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/70 hover:text-primary hover:bg-primary/5"
              }`}
              onClick={() => setTimeout(() => setIsOpen(false), 100)}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      )}
    </aside>
  );
}
