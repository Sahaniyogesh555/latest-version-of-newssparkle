import { useEffect, useState } from "react";

interface Heading { id: string; text: string; level: number }

export function TableOfContents({ content }: { content: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    // Parse markdown headings (## and ###)
    const lines = content.split("\n");
    const h: Heading[] = [];
    for (const line of lines) {
      const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
      if (!m) continue;
      const text = m[2].replace(/[*_`]/g, "").trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
      h.push({ id, text, level: m[1].length });
    }
    setHeadings(h);
  }, [content]);

  useEffect(() => {
    if (!headings.length) return;
    // Assign IDs to rendered headings (react-markdown doesn't by default with our config)
    const els = document.querySelectorAll(".prose-article h2, .prose-article h3");
    els.forEach((el, i) => { if (headings[i]) el.id = headings[i].id; });

    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-80px 0px -70% 0px" });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <nav aria-label="Table of contents" className="not-prose">
      <div className="kicker text-byline mb-3">In this article</div>
      <ol className="space-y-2 border-l border-border">
        {headings.map(h => (
          <li key={h.id} className={h.level === 3 ? "pl-7" : "pl-4"}>
            <a href={`#${h.id}`}
              className={`block text-sm leading-snug py-1 -ml-px border-l-2 pl-3 transition-colors ${
                active === h.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-foreground/70 hover:text-primary hover:border-primary/40"
              }`}>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
