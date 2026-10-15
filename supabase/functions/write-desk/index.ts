// write-desk — cron */30
//
// Claims candidates from the queue and turns them into finished drafts:
// rewrite → verify → score → schedule or hold. Anything that fails the safety,
// plagiarism, duplication or quality gates is held or rejected; nothing is ever
// published from this function.
//
// POST body (optional): { edition?: "morning"|"midday"|"evening", limit?: number, categories?: string[] }
// Auth: shared automation secret.

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { runWriteDesk } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";
import type { Edition } from "../_shared/types.ts";

const EDITIONS: Edition[] = ["morning", "midday", "evening"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ edition?: string; limit?: number; categories?: string[] }>(req);
  const edition = EDITIONS.includes(body.edition as Edition) ? (body.edition as Edition) : undefined;

  try {
    const runtime = createRuntime("write-desk");
    const summary = await runWriteDesk(pipelineDeps(runtime), {
      edition,
      limit: typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 6) : undefined,
      categories: Array.isArray(body.categories) ? body.categories : undefined,
    });
    return json(summary, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[write-desk] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
