// @vitest-environment node
/**
 * Guards the operator-facing read-only preflight pack
 * (phase6_preflight_readonly.sql): it must keep parsing and running against a
 * migrated schema, and its transaction must really be read-only.
 *
 * This runs against the PGlite staging database built from the same migrations,
 * not against the target project. The target-project results stay BLOCKED until
 * somebody with credentials runs the pack and pastes the output.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { createStagingDb, type StagingDb } from "./harness/sql-staging.ts";

const PACK = readFileSync("phase6_preflight_readonly.sql", "utf8");

let staging: StagingDb;

beforeAll(async () => {
  staging = await createStagingDb();
}, 180_000);

afterAll(async () => {
  await staging?.close();
});

describe("read-only preflight pack", () => {
  it("executes end to end against the migrated schema", async () => {
    const notices: string[] = [];
    await staging.db.exec(PACK, { onNotice: (notice) => notices.push(notice.message) });

    expect(staging.runs.filter((run) => !run.ok)).toEqual([]);
    // The inventory and the bookkeeping sections both report through notices;
    // an empty list would mean the DO blocks never ran.
    const text = notices.join("\n");
    expect(text).toMatch(/cron\.job: \d+ rows, \d+ active, \d+ inactive/);
    expect(text).toMatch(/schema_migrations: (ABSENT|.*rows)/);
  }, 120_000);

  it("cannot write: the transaction is READ ONLY", async () => {
    await expect(
      staging.db.exec(
        "begin transaction read only; insert into public.categories(name, slug) values ('audit','audit'); rollback;",
      ),
    ).rejects.toThrow(/read-only transaction/);
  }, 60_000);
});
