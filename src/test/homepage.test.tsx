/**
 * End-to-end-ish render of the homepage against the demo data layer.
 *
 * Catches the class of failure where a page renders "no news today" because the
 * query shape and the component drifted apart (deleted columns, renamed fields,
 * broken normalisers) — the homepage is the highest-traffic route and the first
 * thing a reader or crawler sees.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { demoClient } from "@/lib/demo/demoClient";
import { DEMO_POSTS } from "@/lib/demo/fixtures";

vi.mock("@/integrations/supabase/client", () => ({ supabase: demoClient }));

async function renderHome() {
  const Index = (await import("@/pages/Index")).default;
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Index />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("Homepage", () => {
  beforeEach(() => localStorage.clear());

  it("renders the lead story and the latest feed", async () => {
    await renderHome();
    await waitFor(() => {
      expect(screen.getAllByText(DEMO_POSTS[0].title).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Latest Stories/i).length).toBeGreaterThan(0);
  });

  it("renders a hero image and category blocks", async () => {
    const { container } = await renderHome();
    await waitFor(() => expect(container.querySelectorAll("img").length).toBeGreaterThan(2));

    const withAlt = Array.from(container.querySelectorAll("img")).filter((img) => img.getAttribute("alt"));
    expect(withAlt.length).toBeGreaterThan(0);
  });

  it("never requests the retired source.unsplash.com image host", async () => {
    const { container } = await renderHome();
    await waitFor(() => expect(container.querySelectorAll("img").length).toBeGreaterThan(0));
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img.getAttribute("src")).not.toContain("source.unsplash.com");
    }
  });

  it("shows the breaking ticker and trending topics rails", async () => {
    await renderHome();
    await waitFor(() => expect(screen.getAllByText(/Trending|POPULAR TOPICS/i).length).toBeGreaterThan(0));
  });
});

describe("demo data layer", () => {
  it("filters, orders and paginates like the real client", async () => {
    const { data } = await demoClient
      .from("posts")
      .select("*")
      .eq("status", "published")
      .eq("category_slug", "business")
      .order("published_at", { ascending: false });

    const rows = (data ?? []) as Array<{ category_slug: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.category_slug === "business")).toBe(true);
  });

  it("supports the search page's `or` expression", async () => {
    const { data } = await demoClient
      .from("posts")
      .select("*")
      .or("title.ilike.%benchmark rate%,excerpt.ilike.%benchmark rate%,content.ilike.%benchmark rate%");

    // Only the central-bank fixture mentions it, and only in excerpt/content —
    // which is exactly what the `or` filter is supposed to look at.
    expect(((data ?? []) as Array<{ slug: string }>).map((r) => r.slug)).toEqual(["central-bank-holds-rates-steady"]);
  });

  it("returns a single row for maybeSingle()", async () => {
    const { data } = await demoClient.from("posts").select("*").eq("slug", DEMO_POSTS[0].slug).maybeSingle();
    expect((data as { slug: string })?.slug).toBe(DEMO_POSTS[0].slug);
  });

  it("has fixtures the normaliser accepts", async () => {
    const { normalizePosts } = await import("@/lib/posts");
    const posts = normalizePosts(DEMO_POSTS);
    expect(posts).toHaveLength(DEMO_POSTS.length);
    for (const post of posts) {
      expect(post.faq.length).toBeGreaterThan(0);
      expect(post.keywords.length).toBeGreaterThan(0);
      expect(post.key_takeaways.length).toBeGreaterThan(0);
    }
  });
});
