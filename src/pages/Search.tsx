import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PostCard } from "@/components/PostCard";
import { Post } from "@/lib/types";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    setLoading(true);
    const term = q.replace(/[%_]/g, "\\$&");
    supabase.from("posts").select("*").eq("status", "published")
      .or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,content.ilike.%${term}%`)
      .order("published_at", { ascending: false }).limit(40)
      .then(({ data }) => { setResults((data as Post[]) || []); setLoading(false); });
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (t) setParams({ q: t });
  };

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

        {q && (
          <p className="mt-6 text-sm text-byline">
            {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"} for "${q}"`}
          </p>
        )}
      </div>

      <div className="container-wide pb-16">
        {results.length > 0 && (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        )}
        {!loading && q && results.length === 0 && (
          <p className="text-center py-20 text-byline">No stories matched. Try a broader query.</p>
        )}
      </div>
    </Layout>
  );
}
