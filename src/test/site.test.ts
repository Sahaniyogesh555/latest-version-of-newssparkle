import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORIES, SITE, categoryColor, categoryDescription, categoryName, formatDate } from "@/lib/site";
import { AUTHORS, findAuthor, findAuthorBySlug } from "@/lib/authors";

describe("SITE", () => {
  it("uses an absolute canonical origin, never window.location", () => {
    expect(SITE.url).toMatch(/^https?:\/\//);
    expect(SITE.url.endsWith("/")).toBe(false);
  });

  it("points the logo at the file that actually ships", () => {
    expect(SITE.logo).toBe("/logo.png");
  });
});

describe("CATEGORIES", () => {
  it("covers exactly the sections the newsroom publishes", () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
      "breaking-news",
      "politics",
      "business",
      "technology",
      "health",
      "entertainment",
    ]);
  });

  it("has unique slugs, names and descriptions", () => {
    for (const key of ["slug", "name", "description"] as const) {
      const values = CATEGORIES.map((c) => c[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("resolves colours, names and descriptions with sensible fallbacks", () => {
    expect(categoryColor("politics")).toBe("hsl(var(--cat-politics))");
    expect(categoryColor("world")).toBe("hsl(var(--primary))");
    expect(categoryName("health")).toBe("Health & Lifestyle");
    expect(categoryName("world")).toBe("world");
    expect(categoryDescription("nope")).toMatch(/Independent reporting/);
  });
});

describe("authors registry", () => {
  it("ships a desk for every section, so bylines never fall back to a stranger", () => {
    const names = AUTHORS.map((a) => a.name);
    expect(names).toContain("NewsSparkle Editorial Desk");
    expect(names).toContain("Politics & Policy Desk");
    expect(names).toContain("Business & Markets Desk");
    expect(names).toContain("Technology & AI Desk");
    expect(names).toContain("Health & Lifestyle Desk");
    expect(names).toContain("Entertainment & Culture Desk");
  });

  it("matches the desk names the auto-publisher writes into posts.author", () => {
    // Keep in sync with DESK_BY_CATEGORY in supabase/functions/auto-publish/index.ts
    const source = readFileSync(
      resolve(__dirname, "../../supabase/functions/auto-publish/index.ts"),
      "utf8",
    );
    for (const author of AUTHORS) {
      expect(source, `auto-publish must be able to write "${author.name}"`).toContain(author.name);
    }
  });

  it("resolves an author by exact name, by slugified name, and by slug", () => {
    expect(findAuthor("Technology & AI Desk").slug).toBe("technology-desk");
    expect(findAuthor("technology and ai desk").slug).toBe("technology-desk");
    expect(findAuthorBySlug("health-desk")?.name).toBe("Health & Lifestyle Desk");
  });

  it("generates a fallback profile for an unknown byline", () => {
    const fallback = findAuthor("Guest Contributor");
    expect(fallback.name).toBe("Guest Contributor");
    expect(fallback.image).toContain("dicebear");
  });

  it("handles a missing byline without throwing", () => {
    expect(findAuthor(null).slug).toBe("editorial-desk");
  });

  it("references local avatar files for every desk", () => {
    for (const author of AUTHORS) {
      expect(author.image).toMatch(/^\/authors\/[a-z-]+\.png$/);
      expect(author.imageMd).toMatch(/-md\.png$/);
      expect(author.imageSm).toMatch(/-sm\.png$/);
      expect(author.imageLg).toMatch(/-lg\.png$/);
    }
  });
});

describe("formatDate", () => {
  it("formats ISO timestamps for bylines", () => {
    expect(formatDate("2026-05-01T06:00:00.000Z")).toMatch(/2026/);
  });
});
