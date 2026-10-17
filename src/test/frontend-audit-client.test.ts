import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); createClient.mockClear(); });

describe("audit: production client initialization with browser storage disabled", () => {
  it("does not read a denied localStorage getter before the application can render", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Storage unavailable", "SecurityError"); });
    await expect(import("@/integrations/supabase/client")).resolves.toHaveProperty("supabase");
    expect(createClient).toHaveBeenCalledWith(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  });
});
