import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DEMO_POSTS, DEMO_CATEGORIES } from "@/lib/demo/fixtures";
import { POST_CARD_COLUMNS } from "@/lib/posts";
import { postSearchFilter, searchDateBounds, isCalendarDate } from "@/lib/search";

type Result = { data: unknown[] | null; error: { message: string } | null; count: number };
type QueryRecord = { table: string; calls: Array<[string, ...unknown[]]>; resolve?: (value: Result) => void };
const state = vi.hoisted(() => ({ error: false, defer: false, queries: [] as QueryRecord[] }));

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const record: QueryRecord = { table, calls: [] };
      state.queries.push(record);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "contains", "order", "limit", "range", "gte", "lte", "or", "abortSignal"]) {
        chain[method] = (...args: unknown[]) => { record.calls.push([method, ...args]); return chain; };
      }
      chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
        const main = record.calls.some(([method, columns]) => method === "select" && columns === POST_CARD_COLUMNS);
        if (state.defer && main) return new Promise<Result>(done => { record.resolve = done; }).then(resolve, reject);
        const data = table === "categories" ? DEMO_CATEGORIES : DEMO_POSTS;
        return Promise.resolve({ data: state.error ? null : data, error: state.error ? { message: "Network unavailable" } : null, count: data.length }).then(resolve, reject);
      };
      return chain;
    },
  },
}));

const mainQueries = () => state.queries.filter(record => record.calls.some(([method, columns]) => method === "select" && columns === POST_CARD_COLUMNS));

async function page(name: "Search" | "TagPage" | "CategoryPage" | "AuthorPage", path: string) {
  const Page = (await import(`../pages/${name}.tsx`)).default;
  const pattern = name === "Search" ? "/search" : name === "TagPage" ? "/tag/:tag" : name === "CategoryPage" ? "/category/:slug" : "/author/:slug";
  return render(<HelmetProvider><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={<Page />} /><Route path="*" element={<p>Missing</p>} /></Routes></MemoryRouter></HelmetProvider>);
}

beforeEach(() => {
  state.error = false;
  state.defer = false;
  state.queries = [];
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("audit: hostile and malformed public URLs", () => {
  it.each(["100%25", "100%2525"])("uses a router-decoded tag exactly once: %s", async encoded => {
    await page("TagPage", `/tag/${encoded}`);
    const decoded = decodeURIComponent(encoded);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`#${decoded}`);
    await waitFor(() => expect(mainQueries()[0].calls).toContainEqual(["contains", "keywords", [decoded]]));
  });

  it.each([
    "from=bad&to=bad", "from=2026-02-30", "from=2026-13-01", "from=2026-10-18&to=2026-10-01",
  ])("validates custom date bounds without a render crash: %s", async dates => {
    await page("Search", `/search?q=rate&range=custom&${dates}`);
    expect(screen.getByRole("alert")).toHaveTextContent(/valid dates|From date/i);
    expect(mainQueries()).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search");
  });

  it("falls back safely for unknown sort and range values", async () => {
    await page("Search", "/search?q=rate&range=broken&sort=broken&from=bad");
    await waitFor(() => expect(mainQueries()).toHaveLength(1));
    expect(mainQueries()[0].calls).toContainEqual(["order", "published_at", { ascending: false }]);
    expect(mainQueries()[0].calls.some(([method]) => method === "gte")).toBe(false);
    expect(screen.getByLabelText("Published")).toHaveValue("any");
    expect(screen.getByLabelText("Sort by")).toHaveValue("newest");
  });

  it("actually loads the archive when only Most viewed is selected", async () => {
    await page("Search", "/search?sort=popular");
    await waitFor(() => expect(mainQueries()).toHaveLength(1));
    expect(mainQueries()[0].calls).toContainEqual(["order", "views", { ascending: false }]);
    await waitFor(() => expect(screen.getByRole("link", { name: DEMO_POSTS[0].title })).toBeInTheDocument());
  });

  it("quotes delimiters and literal wildcards in a PostgREST OR search", async () => {
    const term = 'energy,(views.gt.0) "quote" 100%_\\';
    await page("Search", `/search?q=${encodeURIComponent(term)}`);
    await waitFor(() => expect(mainQueries()).toHaveLength(1));
    expect(mainQueries()[0].calls).toContainEqual(["or", postSearchFilter(term)]);
    const fragments = postSearchFilter(term).match(/(?:title|excerpt|content)\.ilike\.("(?:\\.|[^"\\])*")/g)!;
    expect(fragments).toHaveLength(3);
    for (const fragment of fragments) {
      expect(JSON.parse(fragment.slice(fragment.indexOf('.ilike.') + 7))).toBe(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
    }
  });
});

describe("audit: visible and recoverable data failures", () => {
  it.each([
    ["Search", "/search?q=rate"], ["TagPage", "/tag/economy"],
    ["CategoryPage", "/category/business"], ["AuthorPage", "/author/business-desk"],
  ] as const)("shows a retry state instead of a false empty archive: %s", async (name, path) => {
    state.error = true;
    await page(name, path);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Stories unavailable"));
    expect(screen.queryByText(/No (stories|published stories)/)).not.toBeInTheDocument();
    state.error = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: DEMO_POSTS[0].title }).length).toBeGreaterThan(0);
  });

  it("ignores a stale search response and aborts the old request", async () => {
    state.defer = true;
    await page("Search", "/search?q=old");
    await waitFor(() => expect(mainQueries()[0]?.resolve).toBeDefined());
    const old = mainQueries()[0];
    const input = screen.getByRole("searchbox", { name: "Search stories" });
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(mainQueries()[1]?.resolve).toBeDefined());
    const latest = mainQueries()[1];
    const signal = old.calls.find(([name]) => name === "abortSignal")?.[1] as AbortSignal;
    expect(signal.aborted).toBe(true);
    await act(async () => latest.resolve!({ data: [{ ...DEMO_POSTS[0], title: "New response" }], error: null, count: 1 }));
    await act(async () => old.resolve!({ data: [{ ...DEMO_POSTS[0], title: "Stale response" }], error: null, count: 1 }));
    expect(screen.getByRole("link", { name: "New response" })).toBeInTheDocument();
    expect(screen.queryByText("Stale response")).not.toBeInTheDocument();
  });

  it("clears loading/results when the query is removed mid-request", async () => {
    state.defer = true;
    await page("Search", "/search?q=old");
    await waitFor(() => expect(mainQueries()[0]?.resolve).toBeDefined());
    const old = mainQueries()[0];
    const input = screen.getByRole("searchbox", { name: "Search stories" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.queryByText("Searching stories…")).not.toBeInTheDocument();
    await act(async () => old.resolve!({ data: DEMO_POSTS, error: null, count: DEMO_POSTS.length }));
    expect(screen.queryByRole("link", { name: DEMO_POSTS[0].title })).not.toBeInTheDocument();
    expect(screen.getByText(/Enter a search term/)).toBeInTheDocument();
  });
});

describe("audit: UTC calendar boundaries", () => {
  it.each([["2024-02-29", true], ["2026-02-29", false], ["2026-10-18", true], ["2026-1-1", false], ["invalid", false]])("checks %s", (value, valid) => {
    expect(isCalendarDate(String(value))).toBe(valid);
  });
  it("includes the entire selected UTC day", () => {
    expect(searchDateBounds("custom", "2026-10-18", "2026-10-18")).toEqual({ from: "2026-10-18T00:00:00.000Z", to: "2026-10-18T23:59:59.999Z", error: null });
  });
});
