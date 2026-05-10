import { useState, useEffect } from "react";
import { Twitter, Facebook, Linkedin, Link2, Check, MessageCircle } from "lucide-react";

interface Props {
  url: string;
  title: string;
}

export function StickyShareBar({ url, title }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const article = document.querySelector('article');
      if (!article) return;

      const rect = article.getBoundingClientRect();
      const articleTop = rect.top;
      const articleBottom = rect.bottom;
      const windowHeight = window.innerHeight;

      // Show when scrolled past article header but still in article
      setIsVisible(articleTop < -100 && articleBottom > windowHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const e = encodeURIComponent;
  const links = [
    { name: "X", href: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`, Icon: Twitter },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, Icon: Facebook },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`, Icon: Linkedin },
    { name: "WhatsApp", href: `https://wa.me/?text=${e(`${title} ${url}`)}`, Icon: MessageCircle },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-2 sm:p-3 shadow-lg transition-all duration-300">
      <div className="flex flex-col gap-2" aria-label="Share this article">
        {links.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${name}`}
            className="size-10 inline-flex items-center justify-center border border-border hover:border-primary hover:text-primary text-byline transition-all duration-200 rounded-full hover:bg-primary/5"
          >
            <Icon className="size-4" />
          </a>
        ))}
        <button
          onClick={copy}
          aria-label="Copy link"
          className="size-10 inline-flex items-center justify-center border border-border hover:border-primary hover:text-primary text-byline transition-all duration-200 rounded-full hover:bg-primary/5"
        >
          {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}