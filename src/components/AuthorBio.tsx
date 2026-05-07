import { Link } from "react-router-dom";
import { AuthorProfile } from "@/lib/authors";
import { formatDate } from "@/lib/site";
import { Calendar, RefreshCw } from "lucide-react";

interface Props {
  author: AuthorProfile;
  publishedAt: string;
  updatedAt?: string | null;
  readingMinutes?: number | null;
}

export function AuthorBio({ author, publishedAt, updatedAt, readingMinutes }: Props) {
  const updated = updatedAt && updatedAt !== publishedAt;
  return (
    <aside className="mt-12 border-t border-b border-border py-6 flex gap-5 items-start">
      <Link to={`/author/${author.slug}`} className="shrink-0">
        <img
          src={author.image}
          alt={`${author.name} avatar`}
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          className="size-[72px] rounded-full bg-muted object-cover ring-1 ring-border"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="kicker text-byline">{author.role}</div>
        <Link to={`/author/${author.slug}`} className="font-serif text-lg font-bold text-headline hover:text-primary transition-colors">
          {author.name}
        </Link>
        <p className="mt-1.5 text-sm text-foreground/80 leading-relaxed line-clamp-2">{author.bio}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-byline uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><Calendar className="size-3" /> Published {formatDate(publishedAt)}</span>
          {updated && (
            <span className="flex items-center gap-1.5"><RefreshCw className="size-3" /> Updated {formatDate(updatedAt!)}</span>
          )}
          {readingMinutes && <span>{readingMinutes} min read</span>}
        </div>
      </div>
    </aside>
  );
}
