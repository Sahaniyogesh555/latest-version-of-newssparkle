/**
 * Repository integrity checks.
 *
 * These guard the failure modes that shipped in this project's history:
 *  - markup pointing at asset paths that do not exist (/logo.svg, /og-default.jpg)
 *  - <source type="image/webp"> advertised for .webp files that were never built
 *  - edge functions that spend money or write to the database without auth
 *  - featured images sourced from a retired third-party service
 *
 * They read files from disk, so they run against the real repository, not a mock.
 */
import { describe, it, expect } from "vitest";
import {
  ALL_JOBS,
  GATE_EXPECTATION,
  GATED_JOB_NAMES,
  GATE_SQL,
  SAFE_JOB_NAMES,
  extractActiveStatements,
  jobNamesInStatement,
  normaliseSql,
} from "./harness/cron-contract";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Strip // and /* *\/ comments so prose about a banned pattern is not flagged. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Historic migrations that legitimately contain an embedded token. Migrations
 * are immutable once applied, and the key they reference is already public in
 * git history — it must be rotated, not rewritten (see the note in
 * 20261015120200_reschedule_auto_publish_18_per_day.sql).
 */
const LEGACY_MIGRATIONS_WITH_EMBEDDED_JWT = ["20260503120747_10533559-1488-404d-a686-8078a344b3f7.sql"];

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

const sourceFiles = [...walk("src", [".ts", ".tsx"]), "index.html"];

describe("referenced assets exist", () => {
  const assetPattern = /["'`(](\/[A-Za-z0-9._@/-]+\.(?:png|jpg|jpeg|svg|webp|ico|json|xml|txt))["'`) ]/g;

  it("every absolute asset path in the source resolves to a file in public/", () => {
    const missing: string[] = [];
    for (const file of sourceFiles) {
      const content = read(file);
      for (const match of content.matchAll(assetPattern)) {
        const path = match[1];
        if (path.startsWith("/post/") || path.startsWith("/author/")) continue;
        if (!existsSync(join(root, "public", path))) missing.push(`${path} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("ships the social card referenced by the SEO component", () => {
    expect(existsSync(join(root, "public/og-default.jpg"))).toBe(true);
  });

  it("keeps the favicon and the social card small enough to be useful", () => {
    expect(statSync(join(root, "public/favicon.png")).size).toBeLessThan(50 * 1024);
    expect(statSync(join(root, "public/logo.png")).size).toBeLessThan(200 * 1024);
    expect(statSync(join(root, "public/og-default.jpg")).size).toBeLessThan(300 * 1024);
  });
});

describe("author avatars", () => {
  const pngs = readdirSync(join(root, "public/authors")).filter((f) => f.endsWith(".png"));

  it("has a webp twin for every avatar png", () => {
    const missing = pngs.filter((f) => !existsSync(join(root, "public/authors", f.replace(/\.png$/, ".webp"))));
    expect(missing).toEqual([]);
  });

  it("has at least one avatar per desk", () => {
    expect(pngs.length).toBeGreaterThanOrEqual(24);
  });
});

describe("edge functions", () => {
  const functions = readdirSync(join(root, "supabase/functions"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name);

  it("requires the automation secret on every write-capable function", () => {
    for (const name of [
      "auto-publish",
      "breaking-news-monitor",
      "notifications-dispatcher",
      "validate-feeds",
      // Phase 6 automation: every one of these can spend money or write content.
      "ingest-feeds",
      "write-desk",
      "publish-scheduler",
      "trend-watch",
      "maintenance",
      "phase6-monitor",
    ]) {
      const source = read(`supabase/functions/${name}/index.ts`);
      expect(source, `${name} must call requireSecret()`).toContain("requireSecret");
    }
  });

  it("keeps the public feeds free of authentication so crawlers can read them", () => {
    for (const name of ["sitemap", "news-sitemap", "rss"]) {
      const source = read(`supabase/functions/${name}/index.ts`);
      expect(source, `${name} is a public endpoint`).not.toContain("requireSecret");
    }
  });

  it("never sources images from the retired source.unsplash.com service", () => {
    for (const name of functions) {
      const source = stripComments(read(`supabase/functions/${name}/index.ts`));
      expect(source, `${name} must not use the retired service`).not.toContain("source.unsplash.com");
    }
  });

  it("declares gateway auth behaviour for every function", () => {
    const config = read("supabase/config.toml");
    for (const name of functions) {
      expect(config, `supabase/config.toml must declare [functions.${name}]`).toContain(`[functions.${name}]`);
    }
  });

  it("schedules only functions that exist and are declared in config.toml", () => {
    // A cron entry that points at a missing function fails silently in
    // production (pg_net records an error nobody reads), so the whole chain is
    // asserted here: cron → edge function → gateway declaration.
    const cron = read("supabase/migrations/20261016090100_phase6_autonomy_crons.sql");
    const config = read("supabase/config.toml");

    const triggered = [...cron.matchAll(/newsroom_trigger\('([a-z0-9-]+)'/g)].map((match) => match[1]);
    // The Phase 5 helper still routes to auto-publish.
    if (cron.includes("trigger_auto_publish(")) triggered.push("auto-publish");

    expect(triggered.length).toBeGreaterThanOrEqual(6);
    for (const name of [...new Set(triggered)]) {
      expect(functions, `${name} must exist as an edge function`).toContain(name);
      expect(config, `${name} must be declared in supabase/config.toml`).toContain(`[functions.${name}]`);
    }
  });

  it("uses no browser-only globals — Deno does not define them", () => {
    // Verified against deno 2.9.6: these are all `undefined` at runtime, so a
    // reference in a function either throws or (worse) gets swallowed by a
    // try/catch and turns the automation into a no-op. breaking-news-monitor
    // shipped with `new DOMParser()` and failed silently for exactly this
    // reason; this test exists so it cannot happen again.
    // Matched as usage patterns, not bare words: `document` is also a local
    // variable name in _shared/trends.ts.
    const browserOnly: Array<{ name: string; pattern: RegExp }> = [
      { name: "DOMParser", pattern: /new\s+DOMParser\s*\(|\bDOMParser\b/ },
      { name: "document", pattern: /(^|[^\w.])document\s*\./ },
      { name: "window", pattern: /(^|[^\w.])window\s*\./ },
      { name: "MutationObserver", pattern: /new\s+MutationObserver\s*\(/ },
      { name: "IntersectionObserver", pattern: /new\s+IntersectionObserver\s*\(/ },
      { name: "ResizeObserver", pattern: /new\s+ResizeObserver\s*\(/ },
      { name: "XMLHttpRequest", pattern: /new\s+XMLHttpRequest\s*\(/ },
      { name: "HTMLElement", pattern: /(^|[^\w.])HTMLElement\b/ },
      { name: "requestAnimationFrame", pattern: /(^|[^\w.])requestAnimationFrame\s*\(/ },
    ];
    const offenders: string[] = [];
    for (const file of walk("supabase/functions", [".ts"])) {
      if (file.endsWith("deno.d.ts")) continue;
      const source = stripComments(read(file));
      for (const { name, pattern } of browserOnly) {
        if (pattern.test(source)) offenders.push(`${name} in ${file}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("resolves every relative import inside supabase/functions", () => {
    // A typo in a shared module path only surfaces at deploy time, when the
    // bundler fails and the cron job starts returning 500s.
    const missing: string[] = [];
    for (const file of walk("supabase/functions", [".ts"])) {
      const source = stripComments(read(file));
      for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
        const target = resolve(join(root, file), "..", match[1]);
        const candidates = [target, `${target}.ts`, join(target, "index.ts")];
        if (!candidates.some((candidate) => existsSync(candidate))) {
          missing.push(`${match[1]} (imported from ${file})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not embed a JWT in new migrations", () => {
    for (const file of readdirSync(join(root, "supabase/migrations"))) {
      if (LEGACY_MIGRATIONS_WITH_EMBEDDED_JWT.includes(file)) continue;
      const sql = read(`supabase/migrations/${file}`);
      expect(sql, `${file} must not contain a hard-coded token`).not.toMatch(/Bearer eyJ/);
    }
  });

  it("revokes anonymous write access to editorial tables", () => {
    const migrations = readdirSync(join(root, "supabase/migrations")).map((f) => read(`supabase/migrations/${f}`)).join("\n");
    expect(migrations).toMatch(/REVOKE ALL ON public\.posts FROM anon/);
    expect(migrations).toMatch(/DROP POLICY IF EXISTS "Anyone can increment views"/);
  });
});

describe("the Phase 6 cron gate is one statement in four places", () => {
  const MIGRATION = "supabase/migrations/20261016090100_phase6_autonomy_crons.sql";
  const REPAIR = "supabase/migrations/20261016090200_phase6_activation_gate.sql";
  const CHECKLIST = "phase6_activation_checklist.txt";
  const OPERATIONS = "docs/OPERATIONS.md";
  const gate = normaliseSql(GATE_SQL);

  it("embeds the identical gate statement in the migration, the repair migration, the checklist and OPERATIONS.md", () => {
    const missing = [MIGRATION, REPAIR, CHECKLIST, OPERATIONS].filter(
      (file) => !normaliseSql(read(file)).includes(gate),
    );
    expect(missing).toEqual([]);
  });

  it("keeps every `active = false` statement in the docs limited to the gated job set", () => {
    const offenders: string[] = [];
    for (const file of [CHECKLIST, OPERATIONS]) {
      const text = read(file);
      for (const statement of extractActiveStatements(text, "false")) {
        const names = jobNamesInStatement(statement);
        // A bare `update cron.job set active = false;` names no job: it may
        // pause the safe jobs too, and the docs say so explicitly.
        if (names.length === 0) continue;
        const unexpected = names.filter((name) => !GATED_JOB_NAMES.includes(name));
        const missingGated = GATED_JOB_NAMES.filter((name) => !names.includes(name));
        if (unexpected.length || missingGated.length) {
          offenders.push(`${file}: ${statement}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("states the same 8-of-14 / 6 expectation in both operator documents", () => {
    expect(GATE_EXPECTATION).toBe(
      `${GATED_JOB_NAMES.length} of ${ALL_JOBS.length} jobs inactive (gated)` +
        ` / ${SAFE_JOB_NAMES.length} active (safe)`,
    );
    for (const file of [CHECKLIST, OPERATIONS]) {
      expect(read(file), file).toContain(GATE_EXPECTATION);
    }
  });

  it("creates every gated job inactive and every safe job active in the migration", () => {
    const migration = read(MIGRATION);
    const gated = [...migration.matchAll(
      /schedule_in_database\(\s*'([a-z0-9-]+)'[\s\S]*?active\s*:=\s*false\s*\)/g,
    )].map((match) => match[1]);
    expect(gated.sort()).toEqual([...GATED_JOB_NAMES].sort());

    const safe = SAFE_JOB_NAMES.filter((name) =>
      new RegExp(`cron\\.schedule\\(\\s*'${name}'`).test(migration),
    );
    expect(safe.sort()).toEqual([...SAFE_JOB_NAMES].sort());

    // Nothing in the migration may switch a job *on* at apply time.
    expect(normaliseSql(migration)).not.toMatch(/set active = true/);
  });

  it("keeps the retired 'everything starts active' wording out of the docs", () => {
    const retired = [
      "creates every job **active**",
      "creates all 14 cron jobs ACTIVE",
      "those 6 rows false",
      "those 7 rows false",
      "disables seven named jobs",
    ];
    for (const file of [CHECKLIST, OPERATIONS]) {
      const text = read(file);
      for (const phrase of retired) expect(text, file).not.toContain(phrase);
    }
  });
});

describe("generated SEO endpoints", () => {
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");

  it("points the sitemap index at the edge functions' real host", () => {
    // Edge functions live on *.supabase.co — never under the front-end domain.
    expect(sitemap).not.toMatch(/newssparkle\.lovable\.app\/functions\//);
    expect(sitemap).toMatch(/\.supabase\.co\/functions\/v1\/(sitemap|news-sitemap)/);
  });

  it("keeps robots.txt free of the same mistake and lists a sitemap", () => {
    expect(robots).not.toMatch(/newssparkle\.lovable\.app\/functions\//);
    expect(robots).toMatch(/^Sitemap: /m);
    expect(robots).toContain("Disallow: /search");
  });
});

describe("build configuration", () => {
  it("type-checks before building", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.build).toContain("typecheck");
    expect(pkg.scripts.verify).toContain("lint");
  });

  it("does not force every page into one chunk (which defeats lazy routes)", () => {
    const config = read("vite.config.ts");
    expect(config).not.toContain('id.includes("src/pages/")');
  });
});
