import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DEMO_POSTS } from "@/lib/demo/fixtures";

const state = vi.hoisted(() => ({ failMore: false }));
const rows = Array.from({ length: 46 }, (_, index) => ({ ...DEMO_POSTS[index % DEMO_POSTS.length], id: `paging-${index}`, slug: `paging-${index}`, title: `Paging story ${index}` }));

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let offset = 0;
      let end = rows.length;
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "abortSignal"]) chain[method] = () => chain;
      chain.range = (from: number, to: number) => { offset = from; end = to + 1; return chain; };
      chain.limit = (limit: number) => { end = limit; return chain; };
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: offset > 0 && state.failMore ? null : rows.slice(offset, end), error: offset > 0 && state.failMore ? { message: "Network unavailable" } : null }).then(resolve);
      return chain;
    },
  },
}));

async function feed() {
  const Index = (await import("@/pages/Index")).default;
  render(<HelmetProvider><MemoryRouter><Index /></MemoryRouter></HelmetProvider>);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Latest Stories" })).toBeInTheDocument());
  return screen.getByRole("heading", { name: "Latest Stories" }).closest("section")!;
}

beforeEach(() => { state.failMore = false; localStorage.clear(); });

describe("audit: homepage pagination", () => {
  it("shows every appended story rather than permanently slicing the feed to 15 cards", async () => {
    const section = await feed();
    expect(within(section).getAllByRole("link")).toHaveLength(12);
    fireEvent.click(within(section).getByRole("button", { name: "Load more stories" }));
    await waitFor(() => expect(within(section).getAllByRole("link")).toHaveLength(27));
    expect(within(section).getByRole("link", { name: "Paging story 30" })).toBeInTheDocument();
  });

  it("keeps existing stories and offers retry instead of claiming the end on failure", async () => {
    state.failMore = true;
    const section = await feed();
    fireEvent.click(within(section).getByRole("button", { name: "Load more stories" }));
    await waitFor(() => expect(within(section).getByRole("alert")).toHaveTextContent(/could not load more/i));
    expect(within(section).getAllByRole("link")).toHaveLength(12);
    expect(within(section).queryByText(/reached the latest coverage/)).not.toBeInTheDocument();
    state.failMore = false;
    fireEvent.click(within(section).getByRole("button", { name: /retry loading/i }));
    await waitFor(() => expect(within(section).getAllByRole("link")).toHaveLength(27));
    expect(within(section).queryByRole("alert")).not.toBeInTheDocument();
  });
});
