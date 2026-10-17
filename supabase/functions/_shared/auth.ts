// Shared authentication for the write-capable edge functions.
//
// Before this existed, `auto-publish` accepted unauthenticated POSTs: anyone
// who guessed the URL could trigger outbound API calls, a paid LLM generation
// and an INSERT into `posts`. `notifications-dispatcher` could be spammed into
// pushing fake "Breaking" alerts to every reader.
//
// Every automation endpoint now requires a shared secret, supplied either as
//   Authorization: Bearer <secret>   (used by pg_cron via Supabase Vault)
//   x-cron-secret: <secret>          (convenience for manual/monitoring calls)
// The secret lives in Vault + function secrets, never in the repository.

export interface AuthOptions {
  /** Environment variable names that may hold an acceptable secret. */
  envVars?: string[];
  /** Also accept the service-role key (for internal service-to-service calls). */
  allowServiceRole?: boolean;
}

/** Constant-time-ish string comparison that does not leak length via early exit. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function extractSecret(req: Request): string | null {
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (headerSecret) return headerSecret;

  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  const apiKey = req.headers.get("apikey")?.trim();
  if (apiKey) return apiKey;

  return null;
}

/**
 * Returns null when the request is authorised, or a 401 Response when it is not.
 * Usage:
 *   const denied = requireSecret(req, { envVars: ["AUTO_PUBLISH_SECRET"] });
 *   if (denied) return denied;
 */
export function requireSecret(req: Request, options: AuthOptions = {}): Response | null {
  const { envVars = ["AUTO_PUBLISH_SECRET", "CRON_SECRET"], allowServiceRole = true } = options;

  const provided = extractSecret(req);
  if (!provided) {
    return new Response(JSON.stringify({ ok: false, error: "Missing credentials." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accepted: string[] = [];
  for (const name of envVars) {
    const value = Deno.env.get(name);
    if (value) accepted.push(value);
  }
  if (allowServiceRole) {
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRole) accepted.push(serviceRole);
  }

  if (accepted.length === 0) {
    console.error(
      `[auth] Refusing request: none of ${envVars.join(", ")} (or SUPABASE_SERVICE_ROLE_KEY) is configured.`,
    );
    return new Response(
      JSON.stringify({ ok: false, error: "Server is not configured with an automation secret." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (accepted.some((secret) => safeEqual(secret, provided))) return null;

  return new Response(JSON.stringify({ ok: false, error: "Invalid credentials." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
