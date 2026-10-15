/**
 * Development-only Supabase stand-in.
 *
 * Enabled by `VITE_DEMO_MODE=true`. It implements just enough of the query
 * builder for the app's read paths, backed by fixtures.ts, so the UI can be
 * developed and previewed without a database connection.
 *
 * Nothing here runs in production: the flag is off by default, and when it is
 * off this module is never imported by the real client.
 */
import { DEMO_CATEGORIES, DEMO_NOTIFICATIONS, DEMO_POSTS, type DemoPost } from "./fixtures";

type Row = Record<string, unknown>;

/**
 * The subset of the PostgREST query builder the app uses. Declaring it
 * explicitly keeps call sites type-checked and lets tests `await` the chain.
 */
export interface DemoQuery {
  select: (columns?: string, options?: { count?: string; head?: boolean }) => DemoQuery;
  eq: (column: string, value: unknown) => DemoQuery;
  neq: (column: string, value: unknown) => DemoQuery;
  gt: (column: string, value: unknown) => DemoQuery;
  gte: (column: string, value: unknown) => DemoQuery;
  lt: (column: string, value: unknown) => DemoQuery;
  lte: (column: string, value: unknown) => DemoQuery;
  in: (column: string, values: unknown[]) => DemoQuery;
  contains: (column: string, values: unknown[]) => DemoQuery;
  or: (expression: string) => DemoQuery;
  ilike: (column: string, pattern: string) => DemoQuery;
  order: (column: string, options?: { ascending?: boolean }) => DemoQuery;
  limit: (count: number) => DemoQuery;
  range: (from: number, to: number) => DemoQuery;
  returns: () => DemoQuery;
  abortSignal: () => DemoQuery;
  overrideTypes: () => DemoQuery;
  throwOnError: () => DemoQuery;
  single: () => Promise<{ data: Row | null; error: { message: string } | null }>;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
  then: <T>(resolve: (value: { data: Row[] | null; error: null; count: number }) => T) => Promise<T>;
}

const TABLES: Record<string, Row[]> = {
  posts: DEMO_POSTS as unknown as Row[],
  categories: DEMO_CATEGORIES as unknown as Row[],
  notifications: DEMO_NOTIFICATIONS as unknown as Row[],
  feed_validation_runs: [],
};

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/** Supports the `col.ilike.%term%` fragments used by the search page. */
function matchesOr(row: Row, expression: string): boolean {
  const terms = [...expression.matchAll(/([a-z_]+)\.ilike\.%([^%,]+)%/gi)];
  if (terms.length === 0) return true;
  return terms.some(([, column, needle]) =>
    String(row[column] ?? "").toLowerCase().includes(needle.toLowerCase()),
  );
}

function makeChain(table: string): DemoQuery {
  let rows: Row[] = [...(TABLES[table] ?? [])];
  let head = false;

  const api: Record<string, unknown> = {};

  const step = (name: string, fn: (args: unknown[]) => void) => {
    api[name] = (...args: unknown[]) => {
      fn(args);
      return api;
    };
  };

  step("eq", ([column, value]) => { rows = rows.filter((r) => r[column as string] === value); });
  step("neq", ([column, value]) => { rows = rows.filter((r) => r[column as string] !== value); });
  step("gt", ([column, value]) => { rows = rows.filter((r) => String(r[column as string]) > String(value)); });
  step("gte", ([column, value]) => { rows = rows.filter((r) => String(r[column as string]) >= String(value)); });
  step("lt", ([column, value]) => { rows = rows.filter((r) => String(r[column as string]) < String(value)); });
  step("lte", ([column, value]) => { rows = rows.filter((r) => String(r[column as string]) <= String(value)); });
  step("in", ([column, values]) => {
    const list = asRows(values).map(String);
    rows = rows.filter((r) => list.includes(String(r[column as string])));
  });
  step("contains", ([column, values]) => {
    const list = asRows(values).map(String);
    rows = rows.filter((r) => {
      const cell = r[column as string];
      return Array.isArray(cell) && list.every((v) => cell.includes(v));
    });
  });
  step("or", ([expression]) => { rows = rows.filter((r) => matchesOr(r, String(expression))); });
  step("ilike", ([column, pattern]) => {
    const needle = String(pattern).replace(/%/g, "").toLowerCase();
    rows = rows.filter((r) => String(r[column as string] ?? "").toLowerCase().includes(needle));
  });
  step("order", ([column, options]) => {
    const ascending = (options as { ascending?: boolean } | undefined)?.ascending ?? true;
    rows = [...rows].sort((a, b) => {
      const left = String(a[column as string] ?? "");
      const right = String(b[column as string] ?? "");
      return ascending ? left.localeCompare(right) : right.localeCompare(left);
    });
  });
  step("limit", ([count]) => { rows = rows.slice(0, Number(count)); });
  step("range", ([from, to]) => { rows = rows.slice(Number(from), Number(to) + 1); });

  // Callable but ignored: projection, count mode, abort signals, overrides.
  step("select", ([, options]) => {
    head = Boolean((options as { head?: boolean } | undefined)?.head);
  });
  for (const noop of ["returns", "abortSignal", "overrideTypes", "throwOnError"]) step(noop, () => {});

  const finish = () => ({ data: head ? null : rows, error: null, count: rows.length });
  api.single = async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: "No rows found" } });
  api.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
  api.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(finish()).then(resolve, reject);

  return api as unknown as DemoQuery;
}

const channel = {
  on: () => channel,
  subscribe: () => channel,
  unsubscribe: () => channel,
};

export const demoClient = {
  from: (table: string) => makeChain(table),
  rpc: async () => ({ data: null, error: null }),
  channel: () => channel,
  removeChannel: () => {},
};

/** Demo mode is opt-in and never inferred from the environment. */
export const isDemoMode =
  String(import.meta.env.VITE_DEMO_MODE ?? "").toLowerCase() === "true";
