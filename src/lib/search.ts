export type DateRange = "any" | "24h" | "7d" | "30d" | "year" | "custom";
export type SortBy = "newest" | "oldest" | "popular";

export const DATE_RANGES: DateRange[] = ["any", "24h", "7d", "30d", "year", "custom"];
export const SORT_ORDERS: SortBy[] = ["newest", "oldest", "popular"];

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Calendar-day filters are UTC, inclusive, and validated before any ISO conversion. */
export function searchDateBounds(range: DateRange, from: string, to: string, now = Date.now()) {
  if (range === "custom") {
    if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to))) {
      return { from: undefined, to: undefined, error: "Enter valid dates in YYYY-MM-DD format." };
    }
    if (from && to && from > to) {
      return { from: undefined, to: undefined, error: "The From date must be on or before the To date." };
    }
    return { from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T23:59:59.999Z` : undefined, error: null };
  }
  const days: Partial<Record<DateRange, number>> = { "24h": 1, "7d": 7, "30d": 30, year: 365 };
  return { from: days[range] ? new Date(now - days[range]! * 86_400_000).toISOString() : undefined, to: undefined, error: null };
}

/**
 * .or() accepts raw PostgREST grammar. Quote the entire ilike value so commas,
 * parentheses and quotes remain search text, and escape SQL LIKE wildcards.
 * JSON string quoting also escapes the backslashes needed by that grammar.
 */
export function postSearchFilter(term: string): string {
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const value = JSON.stringify(pattern);
  return ["title", "excerpt", "content"].map(column => `${column}.ilike.${value}`).join(",");
}
