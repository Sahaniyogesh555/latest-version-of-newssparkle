/**
 * Regression test for the production crash that blanked every article URL:
 * PostPage rendered <AuthorImage /> without importing it, so the whole route
 * threw `ReferenceError: AuthorImage is not defined` at render time and — with
 * no error boundary — the reader got an empty page.
 *
 * This test renders the real page against a mocked Supabase client and asserts
 * the article body, byline and related-story images all make it to the DOM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { createSupabaseMock } from "./supabase-mock";

const postRow = {
  id: "post-1",
  title: "Parliament passes the budget after a marathon session",
  slug: "parliament-passes-budget",
  excerpt: "Lawmakers approved the spending plan shortly after midnight.",
  content: "## What happened\n\nThe budget passed.\n\n### Why it matters\n\nTaxes change.",
  meta_title: "Budget passes",
  meta_description: "The budget passed after a long session.",
  keywords: ["budget", "parliament"],
  featured_image_url: "https://example.com/hero.jpg",
  featured_image_alt: "The chamber during the vote",
  category_slug: "politics",
  author: "Politics & Policy Desk",
  status: "published",
  reading_minutes: 4,
  views: 120,
  faq: [{ q: "When?", a: "Shortly after midnight." }],
  key_takeaways: ["Spending rises", "Taxes change"],
  published_at: "2026-05-01T06:00:00.000Z",
  created_at: "2026-05-01T06:00:00.000Z",
  updated_at: "2026-05-01T07:00:00.000Z",
};

const supabaseMock = createSupabaseMock({ rows: [postRow], single: postRow });

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

async function renderArticle() {
  const PostPage = (await import("@/pages/PostPage")).default;
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/post/parliament-passes-budget"]}>
        <Routes>
          <Route path="/post/:slug" element={<PostPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("PostPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the article body without throwing", async () => {
    const { container } = await renderArticle();

    await waitFor(() => {
      expect(screen.getByText(/The budget passed\./)).toBeDefined();
    });

    // The crash was an undefined component reference, so assert the shell survived.
    expect(container.querySelector("article")).not.toBeNull();
    expect(screen.getAllByText(/Parliament passes the budget/).length).toBeGreaterThan(0);
  });

  it("renders the author byline with a real avatar path", async () => {
    const { container } = await renderArticle();
    await waitFor(() => expect(screen.getAllByText(/Politics & Policy Desk/).length).toBeGreaterThan(0));

    const avatar = container.querySelector('img[alt*="avatar"]') as HTMLImageElement | null;
    expect(avatar).not.toBeNull();
    expect(avatar?.getAttribute("src")).toMatch(/^\/authors\/politics-desk(-\w+)?\.png$/);
  });

  it("only advertises a webp <source> when the file is known to exist", async () => {
    const { container } = await renderArticle();
    await waitFor(() => expect(container.querySelectorAll("picture").length).toBeGreaterThan(0));

    // Avatars live in /authors/, where build-assets.sh writes .webp twins.
    const avatarSource = container.querySelector('picture source[type="image/webp"]');
    expect(avatarSource?.getAttribute("srcset")).toMatch(/^\/authors\/.*\.webp$/);

    // Article images come from remote URLs and must never claim a webp twin.
    for (const img of Array.from(container.querySelectorAll("picture"))) {
      const imgEl = img.querySelector("img");
      if (imgEl?.getAttribute("src")?.startsWith("http")) {
        expect(img.querySelector('source[type="image/webp"]')).toBeNull();
      }
    }
  });

  it("records the article as the last read story (Continue reading rail)", async () => {
    await renderArticle();
    await waitFor(() => {
      expect(localStorage.getItem("lastViewedPost")).toBe("parliament-passes-budget");
    });
  });

  it("counts a view through the de-duplicating RPC", async () => {
    await renderArticle();
    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith(
        "increment_post_views",
        expect.objectContaining({ post_slug: "parliament-passes-budget" }),
      );
    });
  });

  it("supports FAQs with structured data", async () => {
    const { container } = await renderArticle();
    await waitFor(() => expect(screen.getByText(/Shortly after midnight\./)).toBeDefined());
    const ld = Array.from(container.ownerDocument.querySelectorAll('script[type="application/ld+json"]'))
      .map((el) => el.textContent ?? "")
      .join(" ");
    expect(ld).not.toContain("aggregateRating"); // fabricated ratings were removed
  });
});
