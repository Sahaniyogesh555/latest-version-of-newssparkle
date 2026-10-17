import { Twitter, Facebook, Linkedin, Link2, Check, MessageCircle } from "lucide-react";
import { useClipboard } from "@/hooks/use-clipboard";

interface Props {
  url: string;
  title: string;
  compact?: boolean;
  vertical?: boolean;
}

export function ShareBar({ url, title, compact = false, vertical = false }: Props) {
  const { copied, copyFailed, copy } = useClipboard(url);
  const e = encodeURIComponent;
  const links = [
    { name: "X", href: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(title)}`, Icon: Twitter },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, Icon: Facebook },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`, Icon: Linkedin },
    { name: "WhatsApp", href: `https://wa.me/?text=${e(`${title} ${url}`)}`, Icon: MessageCircle },
  ];
  const size = vertical ? "size-10" : compact ? "size-8" : "size-9";
  const iconSize = compact ? "size-3.5" : "size-4";
  const buttonClass = `${size} shrink-0 inline-flex items-center justify-center border border-border hover:border-primary hover:text-primary text-byline transition-colors rounded-full`;

  return (
    <div role="group" aria-label="Share this article" className={`flex gap-2 ${vertical ? "flex-col" : "items-center flex-wrap"}`}>
      {links.map(({ name, href, Icon }) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${name}`} className={buttonClass}><Icon className={iconSize} /></a>
      ))}
      <button type="button" onClick={copy} aria-label={copied ? "Link copied" : "Copy link"} className={buttonClass}>
        {copied ? <Check className={`${iconSize} text-primary`} /> : <Link2 className={iconSize} />}
      </button>
      <span role="status" className="sr-only">{copied ? "Article link copied." : ""}</span>
      {copyFailed && (
        <div className={vertical ? "w-52" : "basis-full"}>
          <p role="alert" className="text-xs text-byline mb-2">Clipboard unavailable. Select and copy this link instead.</p>
          <input aria-label="Article link" readOnly value={url} onFocus={event => event.currentTarget.select()} className="min-w-0 w-full rounded border border-border bg-background p-2 text-xs" />
        </div>
      )}
    </div>
  );
}
