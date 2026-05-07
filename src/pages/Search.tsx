import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { Post } from "@/lib/types";
import { AUTHORS } from "@/lib/authors";
import { X } from "lucide-react";

type Category = { slug: string; name: string };
type DateRange = "any" | "24h" | "7d" | "30d" | "year" | "custom";
type SortBy = "newest" | "oldest" | "popular";

const RANGE_LABELS: Record<DateRange, string> = {
  any: "Any time",
  "24h": "Past 24 hours",
  "7d": "Past 7 days",
  "30d": "Past 30 days",
  year: "Past year",
  custom: "Custom range",
};

function rangeToFromDate(r: DateRange): string | null {
  const now = Date.now();
  const day = 86_400_000;
  switch (r) {
    case "24h": return new Date(now - day).toISOString();
    case "7d": return new Date(now - 7 * day).toISOString();
    case "30d": return new Date(now - 30 * day).toISOString();
    case "year": return new Date(now - 365 * day).toISOString();
    default: return null;
  }
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "all";
  const range = (params.get("range") as DateRange) || "any";
  const fromDate = params.get("from") || "";
  const toDate = params.get("to") || "";
  const sort = (params.get("sort") as SortBy) || "newest";
  const author = params.get("author") || "all";
  const tagsParam = params.get("tags") || "";
  const selectedTags = useMemo(
    () => tagsParam.split(",").map(t => t.trim()).filter(Boolean),
    [tagsParam],
  );

  const [input, setInput] = useState(q);
  const [tagInput, setTagInput] = useState("");
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    supabase.from("categories").select("slug,name").order("name")
      .then(({ data }) => setCategories((data as Category[]) || []));
  }, []);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    setLoading(true);
    const term = q.replace(/[%_]/g, "\\$&");

    let query = supabase.from("posts").select("*").eq("status", "published")
      .or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,content.ilike.%${term}%`);

    if (category !== "all") query = query.eq("category_slug", category);

    if (range === "custom") {
      if (fromDate) query = query.gte("published_at", new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("published_at", end.toISOString());
      }
    } else {
      const since = rangeToFromDate(range);
      if (since) query = query.gte("published_at", since);
    }

    if (sort === "newest") query = query.order("published_at", { ascending: false });
    else if (sort === "oldest") query = query.order("published_at", { ascending: true });
    else query = query.order("views", { ascending: false });

    query.limit(60).then(({ data }) => {
      setResults((data as Post[]) || []);
      setLoading(false);
    });
  }, [q, category, range, fromDate, toDate, sort]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || value === "any" || (key === "sort" && value === "newest")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key === "range" && value !== "custom") {
      next.delete("from");
      next.delete("to");
    }
    setParams(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    const next = new URLSearchParams(params);
    if (t) next.set("q", t); else next.delete("q");
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    setParams(next);
  };

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (range !== "any" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);

  return (
    <Layout>
      <SEO
        title={q ? `Search: ${q}` : "Search"}
        description={q ? `Results for "${q}" on NewsSparkle.` : "Search the NewsSparkle archive."}
        path={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
      />
      <div className="container-prose py-12">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Search</span>
        </nav>
        <h1 className="font-serif text-4xl font-black text-headline">Search</h1>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search stories, topics…"
            className="flex-1 px-4 py-3 bg-background border border-border focus:border-primary focus:outline-none text-base"
          />
          <button className="px-5 py-3 bg-primary text-primary-foreground font-semibold">Search</button>
        </form>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
            Category
            <select
              value={category}
              onChange={e => updateParam("category", e.target.value)}
              className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground normal-case tracking-normal"
            >
              <option value="all">All categories</option>
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
            Published
            <select
              value={range}
              onChange={e => updateParam("range", e.target.value)}
              className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground normal-case tracking-normal"
            >
              {(Object.keys(RANGE_LABELS) as DateRange[]).map(r => (
                <option key={r} value={r}>{RANGE_LABELS[r]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
            Sort by
            <select
              value={sort}
              onChange={e => updateParam("sort", e.target.value)}
              className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground normal-case tracking-normal"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="popular">Most viewed</option>
            </select>
          </label>
        </div>

        {range === "custom" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
              From
              <input
                type="date"
                value={fromDate}
                onChange={e => updateParam("from", e.target.value)}
                className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
              To
              <input
                type="date"
                value={toDate}
                onChange={e => updateParam("to", e.target.value)}
                className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground"
              />
            </label>
          </div>
        )}

        {q && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-sm text-byline">
              {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"} for "${q}"`}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs uppercase tracking-wider text-primary hover:underline"
              >
                Clear filters ({activeFilterCount})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="container-wide pb-16">
        {results.length > 0 && (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}
        {!loading && q && results.length === 0 && (
          <p className="text-center py-20 text-byline">No stories matched. Try a broader query or different filters.</p>
        )}
      </div>
    </Layout>
  );
}
