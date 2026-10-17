// trend-watch — cron 15 */3
//
// Reads public trend feeds, scores the topics, boosts queued candidates that
// match a live trend and records content gaps. It never creates a story on its
// own: a trend can only reprioritise work the desk was already going to do.
//
// POST body (optional): { feeds?: string[], maxTopics?: number }
// Auth: shared automation secret.

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { runTrendWatch } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ feeds?: string[]; maxTopics?: number }>(req);

  try {
    const runtime = createRuntime("trend-watch");
    const summary = await runTrendWatch(pipelineDeps(runtime), {
      feeds: Array.isArray(body.feeds) && body.feeds.length > 0 ? body.feeds : undefined,
      maxTopics: typeof body.maxTopics === "number" ? body.maxTopics : undefined,
    });
    return json(summary, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[trend-watch] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
