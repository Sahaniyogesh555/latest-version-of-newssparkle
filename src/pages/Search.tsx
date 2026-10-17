import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { POST_CARD_COLUMNS, normalizePosts } from "@/lib/posts";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { Post } from "@/lib/types";
import { AUTHORS } from "@/lib/authors";
import { X } from "lucide-react";
import { CATEGORIES } from "@/lib/site";
import { LoadError } from "@/components/LoadError";
import { DATE_RANGES, SORT_ORDERS, isCalendarDate, postSearchFilter, searchDateBounds, type DateRange, type SortBy } from "@/lib/search";

type Category = { slug: string; name: string };

const RANGE_LABELS: Record<DateRange, string> = {
  any: "Any time",
  "24h": "Past 24 hours",
  "7d": "Past 7 days",
  "30d": "Past 30 days",
  year: "Past year",
  custom: "Custom range",
};

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const category = params.get("category") || "all";
  const rawRange = params.get("range") as DateRange;
  const range = DATE_RANGES.includes(rawRange) ? rawRange : "any";
  const fromDate = params.get("from") || "";
  const toDate = params.get("to") || "";
  const rawSort = params.get("sort") as SortBy;
  const sort = SORT_ORDERS.includes(rawSort) ? rawSort : "newest";
  const author = params.get("author") || "all";
  const tagsParam = params.get("tags") || "";
  const selectedTags = useMemo(
    () => Array.from(new Set(tagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean))),
    [tagsParam],
  );

  const [input, setInput] = useState(q);
  const [tagInput, setTagInput] = useState("");
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([...CATEGORIES]);
  const [authors, setAuthors] = useState<string[]>(AUTHORS.map(a => a.name));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inputId = useId();
  const tagId = useId();
  const bounds = useMemo(() => searchDateBounds(range, fromDate, toDate), [range, fromDate, toDate]);
  const hasCriteria = Boolean(q || category !== "all" || range !== "any" || author !== "all" || selectedTags.length || sort !== "newest");

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const [categoryResult, authorResult] = await Promise.all([
          supabase.from("categories").select("slug,name").order("name").abortSignal(controller.signal),
          supabase.from("posts").select("author").eq("status", "published").limit(1000).abortSignal(controller.signal),
        ]);
        if (!active) return;
        if (!categoryResult.error && categoryResult.data?.length) setCategories(categoryResult.data as Category[]);
        if (!authorResult.error) {
          const names = new Set(AUTHORS.map(a => a.name));
          authorResult.data?.forEach(row => row.author && names.add(row.author));
          setAuthors(Array.from(names).sort((a, b) => a.localeCompare(b)));
        }
      } catch {
        // The static section/desk lists remain usable if filter metadata is unavailable.
      }
    })();
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResults([]);
    setError(false);
    setLoading(false);
    if (!hasCriteria || bounds.error) return () => controller.abort();
    setLoading(true);

    (async () => {
      try {
        let query = supabase.from("posts").select(POST_CARD_COLUMNS).eq("status", "published");
        if (q) query = query.or(postSearchFilter(q));
        if (category !== "all") query = query.eq("category_slug", category);
        if (author !== "all") query = query.eq("author", author);
        if (selectedTags.length) query = query.contains("keywords", selectedTags);
        if (bounds.from) query = query.gte("published_at", bounds.from);
        if (bounds.to) query = query.lte("published_at", bounds.to);
        query = sort === "popular"
          ? query.order("views", { ascending: false })
          : query.order("published_at", { ascending: sort === "oldest" });
        const result = await query.limit(60).abortSignal(controller.signal);
        if (result.error) throw result.error;
        if (active) setResults(normalizePosts(result.data));
      } catch (cause) {
        if (active) {
          console.warn("[search] Stories unavailable:", cause);
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [q, category, range, sort, author, selectedTags, bounds, hasCriteria, attempt]);

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

  const setTags = (tags: string[]) => {
    const next = new URLSearchParams(params);
    const unique = Array.from(new Set(tags.map(t => t.toLowerCase()))).filter(Boolean);
    if (unique.length === 0) next.delete("tags");
    else next.set("tags", unique.join(","));
    setParams(next);
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (selectedTags.includes(t)) return;
    setTags([...selectedTags, t]);
  };

  const removeTag = (t: string) => setTags(selectedTags.filter(x => x !== t));

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    setParams(next);
  };

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (range !== "any" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0) +
    (author !== "all" ? 1 : 0) +
    (selectedTags.length > 0 ? 1 : 0);

  return (
    <Layout>
      <SEO
        title={q ? `Search: ${q}` : "Search"}
        description={q ? `Results for "${q}" on NewsSparkle.` : "Search the NewsSparkle archive."}
        path={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
        robots="noindex, follow"
      />
      <div className="container-prose py-12">
        <nav aria-label="Breadcrumb" className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Search</span>
        </nav>
        <h1 className="font-serif text-4xl font-black text-headline">Search</h1>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <label htmlFor={inputId} className="sr-only">Search stories</label>
          <input
            id={inputId}
            type="search"
            name="q"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search stories, topics…"
            className="min-w-0 flex-1 px-4 py-3 bg-background border border-border focus:border-primary focus:outline-none text-base"
          />
          <button className="px-5 py-3 bg-primary text-primary-foreground font-semibold">Search</button>
        </form>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>label]:min-w-0 [&_select]:min-w-0">
          <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
            Category
            <select
              value={category}
              onChange={e => updateParam("category", e.target.value)}
              className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground normal-case tracking-normal"
            >
              <option value="all">All categories</option>
              {category !== "all" && !categories.some(c => c.slug === category) && <option value={category}>{category}</option>}
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
            Author
            <select
              value={author}
              onChange={e => updateParam("author", e.target.value)}
              className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground normal-case tracking-normal"
            >
              <option value="all">All authors</option>
              {author !== "all" && !authors.includes(author) && <option value={author}>{author}</option>}
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
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
                value={isCalendarDate(fromDate) ? fromDate : ""}
                max={isCalendarDate(toDate) ? toDate : undefined}
                onChange={e => updateParam("from", e.target.value)}
                className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-byline uppercase tracking-wider">
              To
              <input
                type="date"
                value={isCalendarDate(toDate) ? toDate : ""}
                min={isCalendarDate(fromDate) ? fromDate : undefined}
                onChange={e => updateParam("to", e.target.value)}
                className="px-3 py-2 bg-background border border-border focus:border-primary focus:outline-none text-sm text-foreground"
              />
            </label>
          </div>
        )}

        {range === "custom" && <p className="mt-2 text-xs text-byline">Dates include the whole day, in UTC.</p>}
        {bounds.error && <p role="alert" className="mt-3 text-sm text-destructive">{bounds.error}</p>}

        <div className="mt-3">
          <label htmlFor={tagId} className="block text-xs text-byline uppercase tracking-wider mb-1">Tags / Keywords</label>
            <div className="flex flex-wrap items-center gap-2 px-2 py-2 bg-background border border-border focus-within:border-primary">
              {selectedTags.map(t => (
                <span
                  key={t}
                  className="inline-flex max-w-full break-all items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs normal-case tracking-normal"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                    className="hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id={tagId}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => { if (tagInput) { addTag(tagInput); setTagInput(""); } }}
                placeholder={selectedTags.length ? "" : "Type a tag and press Enter"}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground normal-case tracking-normal focus:outline-none py-1"
              />
            </div>
        </div>

        {hasCriteria && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p role="status" className="text-sm text-byline">
              {error ? "Search is temporarily unavailable." : bounds.error ? "Check the date filters above." : loading
                ? "Searching…"
                : `${results.length} result${results.length === 1 ? "" : "s"}${q ? ` for "${q}"` : ""}`}
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

      <div className="container-wide pb-16" aria-busy={loading}>
        {!hasCriteria && <p className="text-center py-10 text-byline">Enter a search term or choose a filter to explore the archive.</p>}
        {error && <LoadError onRetry={() => setAttempt(value => value + 1)} />}
        {loading && <p role="status" className="text-center py-12 text-byline">Searching stories…</p>}
        {!error && !loading && results.length > 0 && (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}
        {!error && !bounds.error && !loading && hasCriteria && results.length === 0 && (
          <p className="text-center py-20 text-byline">No stories matched. Try a broader query or different filters.</p>
        )}
      </div>
    </Layout>
  );
}
