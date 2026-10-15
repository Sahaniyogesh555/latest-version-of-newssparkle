// Wiring shared by the Phase 6 automation entry points.
//
// Each edge function is a thin shell: authenticate, build the dependencies,
// call one pipeline runner, return the summary. Keeping the wiring here means
// the six functions stay short enough to audit at a glance.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiConfigFromEnv, type AiConfig } from "./ai.ts";
import { createSupabaseDb, type NewsroomDb } from "./db.ts";
import { imageProvidersFromEnv, type ImageProviderConfig } from "./images.ts";
import type { PipelineDeps } from "./pipeline.ts";

export interface Runtime {
  db: NewsroomDb;
  ai: AiConfig | null;
  images: ImageProviderConfig;
  siteUrl: string;
  log: (event: string, data?: Record<string, unknown>) => void;
}

/** Build the production dependencies from the function environment. */
export function createRuntime(label: string, env: (key: string) => string | undefined = (key) => Deno.env.get(key)): Runtime {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    db: createSupabaseDb(client),
    ai: aiConfigFromEnv(env),
    images: imageProvidersFromEnv(env),
    siteUrl: env("SITE_URL") ?? env("NEWSROOM_BASE_URL") ?? "https://newssparkle.lovable.app",
    log: (event, data) => console.log(`[${label}] ${event}`, data ? JSON.stringify(data) : ""),
  };
}

/** Everything the pipeline needs, minus the per-run extras. */
export function pipelineDeps(runtime: Runtime, extras: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    db: runtime.db,
    ai: runtime.ai,
    images: runtime.images,
    siteUrl: runtime.siteUrl,
    log: runtime.log,
    ...extras,
  };
}

/** Parse a JSON body without throwing on an empty or malformed payload. */
export async function readJsonBody<T extends Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
