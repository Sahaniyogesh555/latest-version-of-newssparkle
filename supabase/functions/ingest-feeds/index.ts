// ingest-feeds — cron */20
//
// Pulls every active feed, validates and de-duplicates the items, classifies
// them and queues them as candidates. It never writes to `posts`: ingestion and
// publishing are separate so a noisy feed cannot reach readers.
//
// POST body (optional): { maxSources?: number, maxItemsPerSource?: number }
// Auth: shared automation secret (see _shared/auth.ts).

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { loadLiveTrends, runIngest } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ maxSources?: number; maxItemsPerSource?: number }>(req);

  try {
    const runtime = createRuntime("ingest-feeds");
    const deps = pipelineDeps(runtime);
    // Live trends let the queue order itself by what readers are looking for.
    const trends = await loadLiveTrends(deps);
    const summary = await runIngest(deps, {
      maxSources: typeof body.maxSources === "number" ? body.maxSources : undefined,
      maxItemsPerSource: typeof body.maxItemsPerSource === "number" ? body.maxItemsPerSource : undefined,
      trends,
    });
    return json(summary, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[ingest-feeds] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
