import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { bookmarks, BookmarkedPost } from "@/lib/bookmarks";
import { toast } from "sonner";

interface Props {
  post: Omit<BookmarkedPost, "saved_at">;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function BookmarkButton({ post, size = "md", showLabel = false }: Props) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(bookmarks.has(post.slug));
    const onChange = () => setSaved(bookmarks.has(post.slug));
    window.addEventListener("ns-bookmarks-change", onChange);
    return () => window.removeEventListener("ns-bookmarks-change", onChange);
  }, [post.slug]);

  const Icon = saved ? BookmarkCheck : Bookmark;
  const sz = size === "sm" ? "size-3.5" : "size-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!bookmarks.toggle(post)) {
          toast.error("Could not update saved articles. Browser storage is unavailable or full.");
        }
      }}
      aria-pressed={saved}
      aria-label={showLabel ? (saved ? "Saved — remove bookmark" : "Save article") : (saved ? "Remove bookmark" : "Save article")}
      className={`relative z-10 inline-flex min-h-8 min-w-8 items-center justify-center gap-1.5 transition-colors ${saved ? "text-primary" : "text-byline hover:text-primary"}`}
    >
      <Icon className={sz} />
      {showLabel && <span className="text-xs uppercase tracking-wider">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
