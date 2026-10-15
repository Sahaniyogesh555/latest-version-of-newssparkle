/**
 * Shared Supabase test double.
 *
 * The real client is never hit from tests: the query builder is replaced by a
 * chainable stub that resolves to the rows you pass in.
 */
import { vi } from "vitest";

type Row = Record<string, unknown>;

export interface SupabaseMockOptions {
  /** Rows returned by any `from(...).select(...)` chain. */
  rows?: Row[];
  /** Per-table rows, when a component queries more than one table. */
  rowsByTable?: Record<string, Row[]>;
  /** Value returned by `.single()` / `.maybeSingle()`. */
  single?: Row | null;
  /** Error surfaced by the query builder, to exercise error states. */
  error?: { message: string } | null;
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const { rows = [], rowsByTable = {}, single = null, error = null } = options;

  const result = (table: string) => ({
    data: error ? null : rowsByTable[table] ?? rows,
    error,
    count: (rowsByTable[table] ?? rows).length,
  });

  const makeChain = (table: string): unknown => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      "select", "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "or", "in",
      "contains", "order", "limit", "range", "returns", "abortSignal", "overrideTypes",
    ]) {
      chain[method] = () => chain;
    }
    chain.single = async () => {
      const { data, error: err } = result(table);
      return { data: single ?? (Array.isArray(data) ? data[0] : data), error: err };
    };
    chain.maybeSingle = chain.single;
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result(table)).then(resolve, reject);
    return chain;
  };

  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => channel,
  };

  return {
    from: vi.fn((table: string) => makeChain(table)),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
}
