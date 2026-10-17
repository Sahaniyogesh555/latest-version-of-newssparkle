import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Exploding(): JSX.Element {
  throw new ReferenceError("AuthorImage is not defined");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the caught error; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders a recovery UI instead of a blank page", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Exploding />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText(/This story hit a snag/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /back to homepage/i })).toBeDefined();
  });

  it("renders children when nothing throws", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>all good</p>
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("all good")).toBeDefined();
  });
});
