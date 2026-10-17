#!/usr/bin/env node
// Type-check the Supabase edge functions with the real Deno runtime.
//
// Why this exists: CI runs Node, the functions run Deno. Tabs vs spaces and
// `DOMParser` both type-check fine in Node and blow up or fail silently in
// Deno, so the only trustworthy check is `deno check` on the actual entry
// points. Two caveats handled here:
//
//   1. The functions import `https://esm.sh/@supabase/supabase-js@2`. Without
//      network access Deno cannot download it, so this script writes a tiny
//      structural stub plus an import map to a temp directory and points Deno
//      at it. Everything else is checked as-is.
//   2. Deno is not a dependency of this project. If no `deno` binary is found
//      the script reports SKIPPED and exits 0, so `npm run verify` stays usable
//      on a workstation that has no Deno installed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const functionsDir = join(root, "supabase", "functions");

const STUB = `// Local stand-in for https://esm.sh/@supabase/supabase-js@2, used only to
// type-check the edge functions offline. The real module is fetched at deploy
// time; the project consumes the client through a structural interface.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SupabaseClient {
  from(table: string): any;
  rpc(name: string, args?: Record<string, unknown>): any;
}
export function createClient(
  _supabaseUrl: string,
  _supabaseKey?: string,
  _options?: Record<string, unknown>,
): SupabaseClient {
  throw new Error("stub for offline type checking — never executed");
}
`;

function findDeno() {
  const candidates = [process.env.DENO_BIN, "deno", join(root, "node_modules", ".bin", "deno")].filter(
    Boolean,
  );
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return { bin: candidate, version: probe.stdout.trim().split("\n")[0] };
  }
  return null;
}

const deno = findDeno();
if (!deno) {
  console.log("check:functions SKIPPED — no deno binary (set DENO_BIN to enable)");
  process.exit(0);
}

const entrypoints = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .map((entry) => join("supabase", "functions", entry.name, "index.ts"))
  .filter((relative) => existsSync(join(root, relative)));

const scratch = mkdtempSync(join(tmpdir(), "newsroom-deno-check-"));
writeFileSync(join(scratch, "supabase-js-stub.ts"), STUB);
const importMapPath = join(scratch, "import_map.json");
writeFileSync(
  importMapPath,
  JSON.stringify(
    { imports: { "https://esm.sh/@supabase/supabase-js@2": `file://${join(scratch, "supabase-js-stub.ts")}` } },
    null,
    2,
  ),
);

console.log(`${deno.version} — checking ${entrypoints.length} function entrypoints (strict)`);
const result = spawnSync(
  deno.bin,
  [
    "check",
    "--no-lock",
    `--import-map=${importMapPath}`,
    join("supabase", "functions", "_shared", "deno.d.ts"),
    ...entrypoints,
  ],
  { cwd: root, stdio: "inherit" },
);

if (result.status === 0) {
  console.log(`check:functions OK — ${entrypoints.length} entrypoints type-check cleanly`);
}
process.exit(result.status ?? 1);
