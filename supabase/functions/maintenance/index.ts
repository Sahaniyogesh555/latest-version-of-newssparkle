// maintenance — cron 40 * * * *
//
// The housekeeping rota: repairs missing featured images, archives dead weight,
// checks outbound links and public endpoints (sitemap, news sitemap, RSS),
// finds orphaned stories and records everything in content_health_checks.
//
// POST body (optional): { offline?: boolean, endpoints?: Array<{ name, url }> }
// Auth: shared automation secret.

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { runMaintenance } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ offline?: boolean; endpoints?: Array<{ name: string; url: string }> }>(req);

  try {
    const runtime = createRuntime("maintenance");
    const summary = await runMaintenance(pipelineDeps(runtime), {
      offline: body.offline === true,
      endpoints: Array.isArray(body.endpoints) ? body.endpoints : undefined,
    });
    return json(summary, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[maintenance] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
