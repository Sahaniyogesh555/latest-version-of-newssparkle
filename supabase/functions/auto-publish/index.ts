// auto-publish — edition orchestrator (cron 0 6 / 0 12 / 0 18 UTC)
//
// Phase 6 turned the single "source → LLM → insert" script into a pipeline with
// separate, auditable stages. This function is the edition runner that ties them
// together three times a day:
//
//   1. ingest       – refresh the candidate queue from the feeds (+ live trends)
//   2. write desk   – rewrite/verify/score enough stories to fill the edition
//   3. publish      – release what is due, subject to the caps and burst limits
//
// Everything that actually writes a post happens through the shared pipeline, so
// the safety gates (safety scan, plagiarism, duplication, quality score) apply
// here exactly as they do on the */30 write-desk cron.
//
// POST body:
//   { slot?: "morning"|"midday"|"evening",   // fallback when the UTC hour is outside a window
//     category?: string, categories?: string[],  // optional section filter
//     topic?: string,                        // headline hint from the breaking-news monitor
//     skipIngest?: boolean }
// Auth: requires AUTO_PUBLISH_SECRET / CRON_SECRET (see _shared/auth.ts).

import { corsHeaders, json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { loadLiveTrends, runIngest, runPublishScheduler, runWriteDesk } from "../_shared/pipeline.ts";
import { createRuntime, pipelineDeps, readJsonBody } from "../_shared/runtime.ts";
import { editionForHour, editionRemaining, nextEdition } from "../_shared/schedule.ts";
import type { Edition } from "../_shared/types.ts";

// Desk roster. The editorial byline written into posts lives with the pipeline
// (DESK_BY_CATEGORY) and is mirrored in src/lib/authors.ts.
const DESK_BY_CATEGORY: Record<string, string> = {
  "breaking-news": "NewsSparkle Editorial Desk",
  world: "NewsSparkle Editorial Desk",
  politics: "Politics & Policy Desk",
  business: "Business & Markets Desk",
  technology: "Technology & AI Desk",
  health: "Health & Lifestyle Desk",
  entertainment: "Entertainment & Culture Desk",
  sports: "NewsSparkle Editorial Desk",
};

const EDITIONS: Edition[] = ["morning", "midday", "evening"];
/** Stories per edition run. The scheduler spreads them out across the window. */
const MAX_STORIES_PER_RUN = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req);
  if (denied) return denied;

  const body = await readJsonBody<{
    slot?: string;
    category?: string;
    categories?: string[];
    topic?: string;
    skipIngest?: boolean;
  }>(req);

  const runtime = createRuntime("auto-publish");
  const deps = pipelineDeps(runtime);
  const now = new Date();

  // The edition is a property of the clock; a caller's slot is only a fallback.
  const edition: Edition =
    editionForHour(now.getUTCHours()) ??
    (EDITIONS.includes(body.slot as Edition) ? (body.slot as Edition) : nextEdition(now.getUTCHours()));

  const categories = Array.isArray(body.categories) && body.categories.length > 0
    ? body.categories
    : body.category
      ? [body.category]
      : undefined;

  const steps: Record<string, unknown> = {};

  try {
    // 1. Queue refresh. A topic hint from the breaking-news monitor is recorded
    // for the log, but the story itself is written from whatever the feeds
    // actually delivered — a bare headline is not a source.
    if (body.skipIngest !== true) {
      const trends = await loadLiveTrends(deps);
      steps.ingest = await runIngest(deps, { trends });
      if (body.topic) steps.topic_hint = body.topic.slice(0, 160);
    }

    // 2. Write to the edition quota.
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const publishedToday = await deps.db.countPublishedSince(startOfDay);
    const scheduledToday = (await deps.db.listPosts({ statuses: ["scheduled"], limit: 50 })).length;
    const quota = Math.min(
      MAX_STORIES_PER_RUN,
      Math.max(0, editionRemaining({ edition, publishedToday, scheduledToday })),
    );

    steps.write =
      quota > 0
        ? await runWriteDesk(deps, { edition, limit: quota, categories })
        : { function: "write-desk", ok: true, itemsOut: 0, metrics: { skipped: "edition-complete" } };

    // 3. Release anything due (respects the daily cap, category caps and gaps).
    steps.publish = await runPublishScheduler(deps, { limit: 2 });

    const wrote = Number((steps.write as { itemsOut?: number }).itemsOut ?? 0);
    const published = Number((steps.publish as { itemsOut?: number }).itemsOut ?? 0);
    const ok = Boolean((steps.write as { ok?: boolean }).ok ?? true) && Boolean((steps.publish as { ok?: boolean }).ok ?? true);

    return json(
      {
        ok,
        edition,
        quota,
        wrote,
        published,
        desks: (categories ?? Object.keys(DESK_BY_CATEGORY)).map((category) => DESK_BY_CATEGORY[category] ?? DESK_BY_CATEGORY.world),
        steps,
      },
      ok ? 200 : 207,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    console.error("[auto-publish] fatal", error);
    return json(
      { ok: false, edition, error: error instanceof Error ? error.message : String(error), steps },
      500,
      corsHeaders,
    );
  }
});
