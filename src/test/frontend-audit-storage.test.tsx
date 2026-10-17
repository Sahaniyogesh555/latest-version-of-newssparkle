import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { bookmarks } from "@/lib/bookmarks";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CookieConsent } from "@/components/CookieConsent";
import { useTheme } from "@/hooks/use-theme";

const post = {
  slug: "audit-story", title: "Audit story", excerpt: "A saved story.", category_slug: "business",
  featured_image_url: null, published_at: "2026-10-18T00:00:00Z",
};

function ThemeReader() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>{theme}</button>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
});
afterEach(() => vi.restoreAllMocks());

describe("audit: browser-storage resilience", () => {
  it.each(['{"bad":true}', 'null', '42', '"text"', '[null,{},42]'])("ignores malformed saved state: %s", raw => {
    localStorage.setItem("ns_bookmarks_v1", raw);
    expect(bookmarks.list()).toEqual([]);
    expect(bookmarks.has(post.slug)).toBe(false);
  });

  it("keeps valid bookmarks while dropping corrupted entries", () => {
    localStorage.setItem("ns_bookmarks_v1", JSON.stringify([{ ...post, saved_at: "2026-10-18T00:00:00Z" }, null, { slug: "incomplete" }]));
    expect(bookmarks.list()).toHaveLength(1);
    expect(bookmarks.has(post.slug)).toBe(true);
  });

  it("does not throw or mark an article saved when storage is full", () => {
    render(<BookmarkButton post={post} />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(bookmarks.add(post)).toBe(false);
  });

  it("still renders and toggles the theme when storage is disabled", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<ThemeReader />);
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement).toHaveClass("dark");
  });

  it("does not store an OS-derived theme as an explicit user preference", () => {
    render(<ThemeReader />);
    expect(localStorage.getItem("ns_theme_v1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(localStorage.getItem("ns_theme_v1")).toBe("dark");
  });

  it("offers consent controls when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);
    expect(screen.getByRole("dialog", { name: "Cookie consent" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not treat invalid consent JSON as an accepted decision", () => {
    localStorage.setItem("ns-cookie-consent", '{"choice":"invalid"}');
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);
    expect(screen.getByRole("dialog", { name: "Cookie consent" })).toBeInTheDocument();
  });
});
