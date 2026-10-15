// phase6-monitor — cron 5,35 * * * *
//
// The newsroom's own smoke alarm. It reads the newsroom_status() snapshot and
// raises alerts when publishing stalls, the candidate queue runs dry, every
// source is disabled, pipelines are failing or the daily AI budget is gone.
//
// It is the endpoint an operator (or an uptime check) should watch: a 200 with
// ok:true means the newsroom is publishing unattended.
//
// POST body (optional): { stalePublishingHours?: number }
// Auth: shared automation secret.

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { autonomyVerdict, runMonitor } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{ stalePublishingHours?: number }>(req);

  try {
    const runtime = createRuntime("phase6-monitor");
    const summary = await runMonitor(pipelineDeps(runtime), {
      stalePublishingHours:
        typeof body.stalePublishingHours === "number" ? Math.max(1, body.stalePublishingHours) : undefined,
    });
    const verdict = autonomyVerdict(summary);
    return json({ ...summary, autonomy: verdict }, summary.ok ? 200 : 207, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[phase6-monitor] fatal", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders);
  }
});
