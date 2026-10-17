// publish-scheduler — cron */10
//
// Flips due, already-approved drafts from "scheduled" to "published" while
// enforcing the daily cap, per-category caps, the minimum gap between stories
// and the per-run burst limit. Overdue posts are re-timed, never dumped.
//
// POST body (optional): { limit?: number, rebalanceOverdue?: boolean }
// Auth: shared automation secret.

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { runPublishScheduler } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ limit?: number; rebalanceOverdue?: boolean }>(req);

  try {
    const runtime = createRuntime("publish-scheduler");
    const summary = await runPublishScheduler(pipelineDeps(runtime), {
      limit: typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 6) : undefined,
      rebalanceOverdue: body.rebalanceOverdue !== false,
    });
    return json(summary, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[publish-scheduler] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
