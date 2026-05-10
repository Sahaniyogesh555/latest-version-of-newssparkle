import { Link } from "react-router-dom";
import { AuthorProfile } from "@/lib/authors";
import { formatDate } from "@/lib/site";
import { Calendar, RefreshCw } from "lucide-react";
import { AuthorImage } from "@/components/AuthorImage";

interface Props {
  author: AuthorProfile;
  publishedAt: string;
  updatedAt?: string | null;
  readingMinutes?: number | null;
}

export function AuthorBio({ author, publishedAt, updatedAt, readingMinutes }: Props) {
  const updated = updatedAt && updatedAt !== publishedAt;
  return (
    <aside className="mt-12 border-t border-b border-border py-6 flex flex-col gap-5 md:flex-row md:items-start">
      <Link to={`/author/${author.slug}`} className="shrink-0">
        <AuthorImage
          author={author}
          size="lg"
          className="ring-2"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="kicker text-byline">{author.role}</div>
        <Link to={`/author/${author.slug}`} className="font-serif text-lg font-bold text-headline hover:text-primary transition-colors">
          {author.name}
        </Link>
        <p className="mt-1.5 text-sm text-foreground/80 leading-relaxed line-clamp-2">{author.bio}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-byline uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><Calendar className="size-3" /> <time dateTime={publishedAt}>Published {formatDate(publishedAt)}</time></span>
          {updated && (
            <span className="flex items-center gap-1.5"><RefreshCw className="size-3" /> <time dateTime={updatedAt!}>Updated {formatDate(updatedAt!)}</time></span>
          )}
          {readingMinutes && <span>{readingMinutes} min read</span>}
        </div>
      </div>
    </aside>
  );
}
