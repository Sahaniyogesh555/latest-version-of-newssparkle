import "@testing-library/jest-dom";
import { vi } from "vitest";

// Phase 6.1 migration tests run in the node environment (PGlite needs it),
// so every jsdom-only shim lives behind this guard.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

if (typeof window !== "undefined") {
  // jsdom ships neither of these; components rely on them for scroll effects,
  // the table of contents and lazy pagination.
  class ObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  Object.defineProperty(window, "IntersectionObserver", { writable: true, value: ObserverStub });
  Object.defineProperty(globalThis, "IntersectionObserver", { writable: true, value: ObserverStub });
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: ObserverStub });
  Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ObserverStub });

  Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
