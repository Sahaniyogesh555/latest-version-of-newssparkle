import { useState } from "react";
import { Twitter, Facebook, Linkedin, Link2, Check, MessageCircle } from "lucide-react";

interface Props {
  url: string;
  title: string;
}

export function ShareBar({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const e = encodeURIComponent;
  const links = [
    { name: "X", href: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`, Icon: Twitter },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, Icon: Facebook },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`, Icon: Linkedin },
    { name: "WhatsApp", href: `https://wa.me/?text=${e(`${title} ${url}`)}`, Icon: MessageCircle },
  ];

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" aria-label="Share this article">
      {links.map(({ name, href, Icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${name}`}
          className="size-9 inline-flex items-center justify-center border border-border hover:border-primary hover:text-primary text-byline transition-colors rounded-full"
        >
          <Icon className="size-4" />
        </a>
      ))}
      <button
        onClick={copy}
        aria-label="Copy link"
        className="size-9 inline-flex items-center justify-center border border-border hover:border-primary hover:text-primary text-byline transition-colors rounded-full"
      >
        {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
      </button>
    </div>
  );
}
