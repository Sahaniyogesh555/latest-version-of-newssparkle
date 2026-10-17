import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { demoClient } from "@/lib/demo/demoClient";
import { DEMO_POSTS } from "@/lib/demo/fixtures";
import { normalizePosts } from "@/lib/posts";
import { HeroFeaturedGrid } from "@/components/HeroFeaturedGrid";
import { PostCard } from "@/components/PostCard";
import { HeaderSearch } from "@/components/HeaderSearch";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";

vi.mock("@/integrations/supabase/client", () => ({ supabase: demoClient }));

function shell(children: React.ReactNode, path = "/") {
  return render(<HelmetProvider><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></HelmetProvider>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("ns-cookie-consent", JSON.stringify({ choice: "rejected" }));
  localStorage.setItem("ns_alert_seen_v1", '["n1"]');
  localStorage.setItem("ns_push_prompt_v1", "dismissed");
});

describe("audit: valid, independently usable article links", () => {
  const posts = normalizePosts(DEMO_POSTS);

  it("keeps secondary hero stories outside the lead link", () => {
    const { container } = shell(<HeroFeaturedGrid featured={posts[0]} secondary={posts.slice(1, 4)} />);
    expect(container.querySelector("a a")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: new RegExp(posts[1].title) })).toHaveAttribute("href", `/post/${posts[1].slug}`);
  });

  it.each(["hero", "default"] as const)("keeps the %s card's bookmark outside its navigation link", variant => {
    shell(<PostCard post={posts[0]} variant={variant} />);
    const button = screen.getByRole("button", { name: "Save article" });
    expect(button.closest("a")).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: posts[0].title })).toHaveAttribute("href", `/post/${posts[0].slug}`);
  });
});

describe("audit: navigation and search dialog", () => {
  it("portals a labelled, modal search dialog outside the sticky header", async () => {
    const { container } = shell(<header><HeaderSearch /></header>);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.closest("header")).toBeNull();
    expect(container.contains(dialog)).toBe(false);
    const input = within(dialog).getByRole("searchbox", { name: "Search stories" });
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("exposes the mobile menu's expanded state and controlled region", () => {
    shell(<Header />);
    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("has no placeholder social links and points RSS to the configured function host", () => {
    const { container } = shell(<Footer />);
    expect(container.querySelector('a[href="#"]')).toBeNull();
    expect(screen.getByRole("link", { name: "RSS feed" })).toHaveAttribute(
      "href", expect.stringMatching(/^https:\/\/[^/]+\.supabase\.co\/functions\/v1\/rss$/),
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent?.trim() || link.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("does not collect email addresses when no newsletter provider exists", () => {
    const { container } = shell(<Footer />);
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(screen.getByText(/email subscriptions.*not available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse latest stories/i })).toHaveAttribute("href", "/category/breaking-news");
  });

  it("keeps the site shell and noindex metadata on a missing page", async () => {
    shell(<NotFound />, "/missing-page");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to home/i })).toHaveAttribute("href", "/");
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow"));
    expect(document.title).toMatch(/Page not found/);
  });
});

describe("audit: honest contact form", () => {
  it("associates every form field with its visible label", () => {
    shell(<Contact />);
    expect(screen.getByLabelText("Your name")).toHaveAttribute("name", "name");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Subject")).toHaveAttribute("name", "subject");
    expect(screen.getByLabelText("Message")).toHaveAttribute("name", "message");
  });

  it("prepares an email draft without claiming server delivery or discarding the message", () => {
    const { container } = shell(<Contact />);
    fireEvent.change(container.querySelector('input[name="name"]')!, { target: { value: "A Reader" } });
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: "reader@example.test" } });
    fireEvent.change(container.querySelector('textarea[name="message"]')!, { target: { value: "Please review this story & its source." } });
    fireEvent.click(screen.getByRole("button", { name: "Prepare email" }));
    const email = screen.getByRole("link", { name: "Open email app" });
    expect(email.getAttribute("href")).toMatch(/^mailto:/);
    expect(decodeURIComponent(email.getAttribute("href")!)).toContain("reader@example.test");
    expect(decodeURIComponent(email.getAttribute("href")!)).toContain("Please review this story & its source.");
    expect(screen.getByText(/has not been sent/i)).toBeInTheDocument();
    expect(container.querySelector('textarea[name="message"]')).toHaveValue("Please review this story & its source.");
    expect(screen.queryByText(/Message received/)).not.toBeInTheDocument();
    fireEvent.change(container.querySelector('textarea[name="message"]')!, { target: { value: "Updated message" } });
    expect(screen.queryByRole("link", { name: "Open email app" })).not.toBeInTheDocument();
  });
});
