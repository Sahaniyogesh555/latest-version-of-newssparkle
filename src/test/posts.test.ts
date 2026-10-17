import { describe, it, expect } from "vitest";
import { normalizePost, normalizePosts, toFaq, toKeywords } from "@/lib/posts";

const baseRow = {
  id: "1",
  title: "Story",
  slug: "story",
  excerpt: "excerpt",
  content: "body",
  meta_title: "meta",
  meta_description: "desc",
  category_slug: "politics",
  author: "Politics & Policy Desk",
  status: "published",
  reading_minutes: 3,
  views: 10,
  published_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("toFaq", () => {
  it("keeps well-formed question/answer pairs", () => {
    expect(toFaq([{ q: "Why?", a: "Because." }])).toEqual([{ q: "Why?", a: "Because." }]);
  });

  it("drops malformed entries instead of leaking them into the UI", () => {
    expect(toFaq([{ q: "Only question" }, { a: "Only answer" }, "nope", 42, null])).toEqual([]);
  });

  it("returns an empty list for non-array JSON", () => {
    expect(toFaq("{not json}")).toEqual([]);
    expect(toFaq(null)).toEqual([]);
    expect(toFaq(undefined)).toEqual([]);
  });
});

describe("toKeywords", () => {
  it("keeps non-empty strings and discards everything else", () => {
    expect(toKeywords(["a", "", "  ", 3, null, "b"])).toEqual(["a", "b"]);
  });

  it("handles null", () => {
    expect(toKeywords(null)).toEqual([]);
  });
});

describe("normalizePost", () => {
  it("coerces a raw database row into the UI shape", () => {
    const post = normalizePost({
      ...baseRow,
      keywords: ["one", 2 as unknown as string],
      key_takeaways: null,
      faq: [{ q: "q", a: "a" }, { broken: true }],
    });
    expect(post.keywords).toEqual(["one"]);
    expect(post.key_takeaways).toEqual([]);
    expect(post.faq).toEqual([{ q: "q", a: "a" }]);
    expect(post.title).toBe("Story");
  });

  it("does not throw on an empty row", () => {
    expect(() => normalizePost({})).not.toThrow();
  });
});

describe("normalizePosts", () => {
  it("returns an empty array for nullish input", () => {
    expect(normalizePosts(null)).toEqual([]);
    expect(normalizePosts(undefined)).toEqual([]);
    expect(normalizePosts("nope")).toEqual([]);
  });

  it("maps every row", () => {
    expect(normalizePosts([baseRow, baseRow])).toHaveLength(2);
  });
});
