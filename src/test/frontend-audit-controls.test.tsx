import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ShareBar } from "@/components/ShareBar";
import { TableOfContents } from "@/components/TableOfContents";
import { PushNotificationsPrompt } from "@/components/PushNotificationsPrompt";
import { BreakingNewsTicker } from "@/components/BreakingNewsTicker";
import { useTheme } from "@/hooks/use-theme";
import { demoClient } from "@/lib/demo/demoClient";
import { postSearchFilter } from "@/lib/search";
import { feedUrl } from "@/lib/endpoints";
import { DEMO_POSTS } from "@/lib/demo/fixtures";

vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("@/lib/demo/demoClient")).demoClient }));

beforeEach(() => { localStorage.clear(); document.documentElement.lang = "en"; });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.getElementById("google-translate-script")?.remove();
  document.getElementById("google_translate_element")?.remove();
  document.querySelector(".goog-te-combo")?.remove();
  delete window.google;
  delete window.googleTranslateElementInit;
});

function languagePage() {
  render(<><main><h1>Latest stories</h1><p>Independent news for every reader.</p></main><LanguageToggle /></>);
}
function chooseLanguage(name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: /Change language/ }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("menuitem", { name }));
}
function fakeWidget(translate = false) {
  const select = document.createElement("select");
  select.className = "goog-te-combo";
  for (const value of ["en", "hi", "ne", "ur", "bn"]) select.add(new Option(value, value));
  if (translate) select.addEventListener("change", () => { document.querySelector("main p")!.textContent = "नमस्ते पाठक"; });
  document.body.appendChild(select);
}

describe("audit: honest translation state", () => {
  it("does not load the translation CDN for an English reader", () => {
    languagePage();
    expect(document.getElementById("google-translate-script")).toBeNull();
  });
  it("does not relabel unchanged English as Nepali when the CDN fails", async () => {
    vi.useFakeTimers();
    languagePage();
    chooseLanguage("Nepali");
    fireEvent.error(document.getElementById("google-translate-script")!);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("preferred_lang")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/translation is unavailable/i);
    expect(screen.getByRole("button", { name: /English.*Change language/ })).toHaveAttribute("aria-busy", "false");
  });
  it("lets the reader cancel a pending translation by choosing English", async () => {
    vi.useFakeTimers();
    languagePage();
    chooseLanguage("Nepali");
    chooseLanguage("English");
    await act(async () => { await vi.advanceTimersByTimeAsync(16000); });
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("preferred_lang")).toBe("en");
    expect(screen.getByRole("button", { name: /English.*Change language/ })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("English original text selected.");
  });
  it("requires a text change, not just a widget accepting the selection", async () => {
    vi.useFakeTimers();
    fakeWidget();
    languagePage();
    chooseLanguage("Nepali");
    await act(async () => { await vi.advanceTimersByTimeAsync(6100); });
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("preferred_lang")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/unavailable/i);
  });
  it("updates the language only after the translation adapter changes page text", async () => {
    fakeWidget(true);
    languagePage();
    chooseLanguage("Nepali");
    await waitFor(() => expect(document.documentElement.lang).toBe("ne"));
    expect(localStorage.getItem("preferred_lang")).toBe("ne");
    expect(screen.getByRole("status")).toHaveTextContent(/may contain errors/i);
  });
  it("ignores an invalid persisted language code", () => {
    localStorage.setItem("preferred_lang", "not-a-language");
    languagePage();
    expect(document.documentElement.lang).toBe("en");
    expect(document.getElementById("google-translate-script")).toBeNull();
  });
});

describe("audit: sharing and article contents", () => {
  it("offers a selectable URL when the clipboard permission is denied", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    render(<ShareBar url="https://example.test/post/story" title="A story" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Clipboard unavailable"));
    expect(screen.getByRole("textbox", { name: "Article link" })).toHaveValue("https://example.test/post/story");
    expect(screen.queryByRole("button", { name: "Link copied" })).not.toBeInTheDocument();
  });
  it("announces successful copy only after the clipboard resolves", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShareBar url="https://example.test/post/story" title="A story" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Link copied" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("https://example.test/post/story");
    expect(screen.getByRole("status")).toHaveTextContent("Article link copied.");
  });
  it("extracts contents only from the story body and exposes expanded state", () => {
    render(<article><h2>Not a body heading</h2><section aria-label="Article body"><h2>First section</h2><h3>Second section</h3></section><TableOfContents /></article>);
    const toggle = screen.getByRole("button", { name: "Contents" });
    if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Article contents" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Not a body heading" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "First section" })).toHaveAttribute("href", "#heading-0");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("audit: preferences and first-visit prompts", () => {
  it("follows OS theme changes until the reader makes an explicit choice", () => {
    let listener: (event: MediaQueryListEvent) => void;
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false, addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => { listener = callback; }, removeEventListener: vi.fn() } as unknown as MediaQueryList);
    function Theme() { const { theme, toggle } = useTheme(); return <button onClick={toggle}>{theme}</button>; }
    render(<Theme />);
    act(() => listener({ matches: true } as MediaQueryListEvent));
    expect(screen.getByRole("button", { name: "dark" })).toBeInTheDocument();
    expect(localStorage.getItem("ns_theme_v1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    act(() => listener({ matches: true } as MediaQueryListEvent));
    expect(screen.getByRole("button", { name: "light" })).toBeInTheDocument();
    expect(localStorage.getItem("ns_theme_v1")).toBe("light");
  });
  it("waits for the consent decision instead of stacking two first-visit prompts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn().mockResolvedValue("denied") });
    render(<PushNotificationsPrompt />);
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new CustomEvent("ns:consent", { detail: { choice: "rejected" } })));
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByRole("dialog", { name: "Enable news notifications" })).toBeInTheDocument();
    expect(screen.getByText(/Background push notifications are not available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(localStorage.getItem("ns_push_prompt_v1")).toBe("dismissed");
  });
  it("allows pausing the rotating headlines with a real button", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><BreakingNewsTicker /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    const first = screen.getByRole("link").getAttribute("href");
    fireEvent.click(screen.getByRole("button", { name: "Pause headlines" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole("link")).toHaveAttribute("href", first);
    fireEvent.click(screen.getByRole("button", { name: "Resume headlines" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByRole("link").getAttribute("href")).not.toBe(first);
  });
});

describe("audit: accurate preview/query and endpoint contracts", () => {
  it("counts filtered demo rows before range/limit pagination", async () => {
    const result = await demoClient.from("posts").select("*", { count: "exact" }).eq("category_slug", "business").range(0, 0);
    expect(result.data).toHaveLength(1);
    expect(result.count).toBe(DEMO_POSTS.filter(post => post.category_slug === "business").length);
  });
  it("sorts views numerically and understands quoted search patterns", async () => {
    const result = await demoClient.from("posts").select("*").order("views", { ascending: false });
    const views = result.data!.map(row => Number(row.views));
    expect(views).toEqual([...views].sort((a, b) => b - a));
    const search = await demoClient.from("posts").select("*").or(postSearchFilter("benchmark rate"));
    expect(search.data?.map(row => row.slug)).toEqual(["central-bank-holds-rates-steady"]);
    const punctuation = await demoClient.from("posts").select("*").or(postSearchFilter('",('));
    expect(punctuation.data).toEqual([]);
  });
  it("never points an RSS link at a frontend function path", () => {
    expect(feedUrl("https://api.example.test/", "rss")).toBe("https://api.example.test/functions/v1/rss");
    expect(feedUrl(undefined, "rss")).toBeUndefined();
    expect(feedUrl("not-a-url", "rss")).toBeUndefined();
    expect(feedUrl("javascript:alert(1)", "rss")).toBeUndefined();
  });
});
