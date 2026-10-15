// Minimal ambient declarations so the Deno-only glue type-checks in CI
// (the sandbox and CI run Node; Supabase runs Deno at deploy time).
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
    function set(key: string, value: string): void;
  }
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  // The client is consumed through the small structural interface in db.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party client shape
  export function createClient(url: string, key: string, options?: unknown): any;
}
