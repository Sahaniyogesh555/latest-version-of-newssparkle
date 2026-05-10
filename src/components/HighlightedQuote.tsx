import { ReactNode } from "react";

interface HighlightedQuoteProps {
  children: ReactNode;
  author?: string;
}

export function HighlightedQuote({ children, author }: HighlightedQuoteProps) {
  return (
    <blockquote className="relative my-8 p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-l-4 border-primary rounded-r-lg shadow-sm">
      <div className="text-2xl font-serif italic text-headline leading-relaxed">
        "{children}"
      </div>
      {author && (
        <cite className="block mt-4 text-sm text-byline font-medium not-italic">
          — {author}
        </cite>
      )}
      <div className="absolute -top-2 -left-2 text-6xl text-primary/20 font-serif leading-none">
        "
      </div>
    </blockquote>
  );
}