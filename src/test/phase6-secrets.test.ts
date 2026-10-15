/**
 * Phase 6.1 — secrets wiring, cost limits and repository hygiene.
 *
 * These are the checks an operator would want before switching the newsroom on
 * unattended: every secret the functions read is documented, the Vault names
 * the SQL reads are the names the docs tell you to create, the spend limits are
 * the ones the report claims, and no credential is committed.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PUBLISH_LIMITS, EDITION_TARGETS } from "../../supabase/functions/_shared/schedule.ts";
import { QUALITY_THRESHOLDS } from "../../supabase/functions/_shared/quality.ts";
import { DEFAULT_DEDUPE_THRESHOLDS } from "../../supabase/functions/_shared/dedupe.ts";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

const functionFiles = walk("supabase/functions", [".ts"]).filter((f) => !f.endsWith("deno.d.ts"));

/** Every environment variable name the function code reads. */
function envVarsUsed(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const patterns = [
    /Deno\.env\.get\("([A-Z0-9_]+)"\)/g,
    /\bgetenv\("([A-Z0-9_]+)"\)/g,
    /\benv\("([A-Z0-9_]+)"\)/g,
    /envVars:\s*\[([^\]]+)\]/g,
  ];

  for (const file of functionFiles) {
    const source = read(file);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const names = match[1].match(/[A-Z][A-Z0-9_]{2,}/g) ?? [];
        for (const name of names) {
          used.set(name, [...(used.get(name) ?? []), file]);
        }
      }
    }
  }
  return used;
}

/** Names Supabase injects into every function — nothing to document. */
const PLATFORM_PROVIDED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];

describe("secret wiring", () => {
  it("documents every environment variable the functions read", () => {
    const envExample = read(".env.example");
    const undocumented = [...envVarsUsed().entries()]
      .filter(([name]) => !PLATFORM_PROVIDED.includes(name))
      .filter(([name]) => !new RegExp(`\\b${name}\\b`).test(envExample))
      .map(([name, files]) => `${name} (read by ${[...new Set(files)].join(", ")})`);

    expect(undocumented).toEqual([]);
  });

  it("tells the operator to create the Vault secrets the SQL reads", () => {
    const cronSql = read("supabase/migrations/20261016090100_phase6_autonomy_crons.sql");
    const vaultNames = [...cronSql.matchAll(/vault\.decrypted_secrets\s+where name = '([a-z_]+)'/g)].map(
      (match) => match[1],
    );
    expect(vaultNames.sort()).toEqual(["auto_publish_secret", "newsroom_base_url"]);

    const docs = [".env.example", "docs/OPERATIONS.md"].map((file) => read(file)).join("\n");
    for (const name of vaultNames) {
      expect(docs, `${name} must be documented for the operator`).toContain(name);
    }
  });

  it("authenticates exactly the header the cron trigger sends", () => {
    const cronSql = read("supabase/migrations/20261016090100_phase6_autonomy_crons.sql");
    const auth = read("supabase/functions/_shared/auth.ts");

    // The trigger builds `Authorization: Bearer <vault secret>`; auth.ts must
    // accept that header, and must read the same env var the docs name.
    expect(cronSql).toMatch(/Authorization/);
    expect(cronSql).toMatch(/'Bearer ' \|\|/);
    expect(auth).toMatch(/req\.headers\.get\("authorization"\)/i);
    expect(auth.toLowerCase()).toContain("bearer ");
    expect(auth).toContain("AUTO_PUBLISH_SECRET");
  });

  it("never sends the automation secret in a URL", () => {
    // A secret in a query string ends up in logs, referrers and pg_net history.
    for (const file of functionFiles) {
      const source = read(file);
      for (const match of source.matchAll(/`[^`]*\$\{?[^`]*\?[^`]*secret[^`]*`/gi)) {
        expect(match[0], `${file} must not put a secret in a query string`).not.toMatch(/secret=/i);
      }
    }
    const cronSql = read("supabase/migrations/20261016090100_phase6_autonomy_crons.sql");
    expect(cronSql).not.toMatch(/functions\/v1\/[a-z-]+\?[^']*secret/i);
  });

  it("commits no live credential", () => {
    const legacy = "supabase/migrations/20260503120747_10533559-1488-404d-a686-8078a344b3f7.sql";
    const scanned = [
      ...walk("src", [".ts", ".tsx"]),
      ...walk("scripts", [".mjs", ".js", ".sh"]),
      ...walk("supabase", [".ts", ".sql"]),
      "README.md",
      "docs/OPERATIONS.md",
      ".env.example",
    ].filter((file) => file !== legacy);

    const offenders = scanned.filter((file) => {
      const source = read(file);
      return /eyJhbGciOi[A-Za-z0-9_-]{10,}/.test(source) || /\bsk-[A-Za-z0-9]{24,}/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("cost and safety limits", () => {
  it("publishes at most 18 stories a day, 5 per section, 25 minutes apart, 2 per run", () => {
    expect(PUBLISH_LIMITS.maxPerDay).toBe(18);
    expect(PUBLISH_LIMITS.maxPerCategoryPerDay).toBe(5);
    expect(PUBLISH_LIMITS.minGapMinutes).toBe(25);
    expect(PUBLISH_LIMITS.maxBurstPerRun).toBe(2);
    expect(PUBLISH_LIMITS.maxCatchUpMinutes).toBe(180);
    expect(PUBLISH_LIMITS.maxLookaheadHours).toBe(12);

    // The three editions must add up to the daily ceiling, or the scheduler
    // either under-publishes or silently exceeds its own cap.
    const editions = Object.values(EDITION_TARGETS).reduce((sum, n) => sum + n, 0);
    expect(editions).toBe(PUBLISH_LIMITS.maxPerDay);
  });

  it("keeps the documented quality gates", () => {
    expect(QUALITY_THRESHOLDS.publish).toBe(75);
    expect(QUALITY_THRESHOLDS.review).toBe(55);
  });

  it("keeps the documented duplicate thresholds", () => {
    expect(DEFAULT_DEDUPE_THRESHOLDS.titleDuplicate).toBe(0.72);
    expect(DEFAULT_DEDUPE_THRESHOLDS.titleNear).toBe(0.55);
    expect(DEFAULT_DEDUPE_THRESHOLDS.contentDuplicate).toBe(0.38);
    expect(DEFAULT_DEDUPE_THRESHOLDS.contentNear).toBe(0.2);
  });

  it("states the same limits in the operator documentation", () => {
    const report = read("phase6_summary.txt");
    expect(report).toMatch(/\b18 posts|18 stories|18\/day|18 per day/i);
    expect(report).toMatch(/\b75\b/);
    expect(report).toMatch(/\b55\b/);
  });

  it("never ships the daily LLM budget above the documented ceiling", () => {
    const pipeline = read("supabase/functions/_shared/pipeline.ts");
    const budget = pipeline.match(/maxLlmCallsPerDay:\s*(\d+)/);
    expect(budget?.[1]).toBe("220");
    // The desk must consult the budget before spending.
    expect(pipeline).toContain("llmCallsToday");
  });
});
