// Scheduling engine.
//
// Publishing must look like a newsroom, not a cron dump: no bursts, no single
// section dominating, a minimum gap between posts, and a hard daily ceiling.
// Everything here is deterministic (seeded by date + edition + index) so the
// plan for a given day can be reproduced and tested.

import type { Edition } from "./types.ts";
import { hash64 } from "./text.ts";

export const PUBLISH_LIMITS = {
  /** Total posts per UTC day across every section. */
  maxPerDay: 18,
  /** No section may take more than this share of the day. */
  maxPerCategoryPerDay: 5,
  /** Minimum spacing between two consecutive publications. */
  minGapMinutes: 25,
  /** Hard cap per scheduler run — protects against catch-up floods. */
  maxBurstPerRun: 2,
  /** If the queue is this far behind, spread the backlog instead of dumping it. */
  maxCatchUpMinutes: 180,
  /** A post may not be scheduled more than this far ahead. */
  maxLookaheadHours: 12,
} as const;

/** Edition targets sum to PUBLISH_LIMITS.maxPerDay. */
export const EDITION_TARGETS: Record<Edition, number> = {
  morning: 5,
  midday: 6,
  evening: 7,
};

export const EDITION_WINDOWS: Record<Edition, { startHour: number; endHour: number }> = {
  morning: { startHour: 6, endHour: 11 },
  midday: { startHour: 12, endHour: 16 },
  evening: { startHour: 17, endHour: 22 },
};

export function editions(): Edition[] {
  return ["morning", "midday", "evening"];
}

/** Which edition a UTC hour belongs to, if any. */
export function editionForHour(hourUtc: number): Edition | null {
  for (const edition of editions()) {
    const { startHour, endHour } = EDITION_WINDOWS[edition];
    if (hourUtc >= startHour && hourUtc <= endHour) return edition;
  }
  return null;
}

/** The next edition that has not started yet (used for catch-up planning). */
export function nextEdition(hourUtc: number): Edition {
  for (const edition of editions()) {
    if (EDITION_WINDOWS[edition].startHour > hourUtc) return edition;
  }
  return "morning"; // wraps to tomorrow
}

/** Deterministic 0..1 jitter so a plan is reproducible for a given day. */
export function deterministicJitter(seed: string): number {
  const hash = hash64(seed);
  const slice = parseInt(hash.slice(0, 8), 16);
  return slice / 0xffffffff;
}

export interface PlannedSlot {
  index: number;
  at: Date;
  edition: Edition;
}

/**
 * Spread `count` publications across an edition window, with jitter and at
 * least `minGapMinutes` between them.
 */
export function planEditionTimes(options: {
  edition: Edition;
  count: number;
  date: string; // YYYY-MM-DD (UTC)
  minGapMinutes?: number;
}): PlannedSlot[] {
  const { edition, count, date } = options;
  const minGap = options.minGapMinutes ?? PUBLISH_LIMITS.minGapMinutes;
  const { startHour, endHour } = EDITION_WINDOWS[edition];
  const windowMinutes = (endHour - startHour + 1) * 60;
  const safeCount = Math.min(Math.max(count, 0), Math.max(1, Math.floor(windowMinutes / minGap)));
  if (safeCount === 0) return [];

  const step = windowMinutes / safeCount;
  const slots: PlannedSlot[] = [];

  for (let i = 0; i < safeCount; i++) {
    const jitter = deterministicJitter(`${date}:${edition}:${i}`);
    const offset = Math.floor(i * step + jitter * Math.max(0, step - minGap));
    const at = new Date(Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      startHour,
      offset,
      0,
      0,
    ));
    slots.push({ index: i, at, edition });
  }

  return slots;
}

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface BalancingInput {
  /** Categories that have candidates ready to publish. */
  available: Array<{ slug: string; candidates: number }>;
  /** Posts already published or scheduled today, per category. */
  publishedToday: Record<string, number>;
  /** Categories that have hit the daily cap and must be skipped. */
  maxPerCategory?: number;
}

export interface BalancedPick {
  slug: string;
  reason: string;
}

/**
 * Order categories by "least published today, then most candidates waiting".
 * Guarantees no single section dominates a day and that a busy section does not
 * starve a quiet one.
 */
export function balanceCategories(input: BalancingInput): BalancedPick[] {
  const max = input.maxPerCategory ?? PUBLISH_LIMITS.maxPerCategoryPerDay;
  return input.available
    .filter((c) => (input.publishedToday[c.slug] ?? 0) < max && c.candidates > 0)
    .map((c) => ({
      slug: c.slug,
      published: input.publishedToday[c.slug] ?? 0,
      candidates: c.candidates,
    }))
    .sort((a, b) =>
      a.published - b.published ||
      b.candidates - a.candidates ||
      a.slug.localeCompare(b.slug),
    )
    .map((c) => ({
      slug: c.slug,
      reason: `${c.published} published today, ${c.candidates} waiting`,
    }));
}

export interface PublishGateInput {
  now: Date;
  lastPublishedAt?: string | Date | null;
  publishedToday: number;
  category: string;
  categoryPublishedToday: number;
  /** Posts already published by this run. */
  publishedThisRun?: number;
  maxPerDay?: number;
  maxPerCategory?: number;
  minGapMinutes?: number;
  maxBurstPerRun?: number;
}

export interface PublishGateResult {
  allowed: boolean;
  reason: string;
  /** Minutes to wait before this post may go out. */
  waitMinutes?: number;
}

/** Burst / flood / domination protection for a single publication. */
export function canPublishNow(input: PublishGateInput): PublishGateResult {
  const maxPerDay = input.maxPerDay ?? PUBLISH_LIMITS.maxPerDay;
  const maxPerCategory = input.maxPerCategory ?? PUBLISH_LIMITS.maxPerCategoryPerDay;
  const minGap = input.minGapMinutes ?? PUBLISH_LIMITS.minGapMinutes;
  const burst = input.maxBurstPerRun ?? PUBLISH_LIMITS.maxBurstPerRun;

  if ((input.publishedThisRun ?? 0) >= burst) {
    return { allowed: false, reason: "burst-limit" };
  }
  if (input.publishedToday >= maxPerDay) {
    return { allowed: false, reason: "daily-cap" };
  }
  if (input.categoryPublishedToday >= maxPerCategory) {
    return { allowed: false, reason: `category-cap:${input.category}` };
  }

  if (input.lastPublishedAt) {
    const last = new Date(input.lastPublishedAt).getTime();
    const elapsedMinutes = (input.now.getTime() - last) / 60000;
    if (elapsedMinutes < minGap) {
      return {
        allowed: false,
        reason: "min-gap",
        waitMinutes: Math.ceil(minGap - elapsedMinutes),
      };
    }
  }

  return { allowed: true, reason: "ok" };
}

export interface CatchUpInput {
  now: Date;
  /** Scheduled posts that are already overdue. */
  overdue: number;
  publishedToday: number;
  maxPerDay?: number;
}

/**
 * If a run was missed (function outage, no candidates, deployment), do not dump
 * the backlog at once: publish a small catch-up batch and let the next runs
 * finish the job.
 */
export function catchUpPlan(input: CatchUpInput): { publish: number; note: string } {
  const maxPerDay = input.maxPerDay ?? PUBLISH_LIMITS.maxPerDay;
  const remaining = Math.max(0, maxPerDay - input.publishedToday);
  if (input.overdue <= 0) return { publish: 0, note: "nothing overdue" };
  if (remaining === 0) return { publish: 0, note: "daily cap reached" };

  const publish = Math.min(input.overdue, remaining, PUBLISH_LIMITS.maxBurstPerRun);
  return {
    publish,
    note:
      publish < input.overdue
        ? `${input.overdue} overdue, releasing ${publish} now and spreading the rest`
        : "releasing the full backlog",
  };
}

/**
 * Re-time overdue posts into the future so they land inside the current or next
 * edition window instead of all at once.
 */
export function rescheduleOverdue(options: {
  now: Date;
  overdueCount: number;
  minGapMinutes?: number;
}): Date[] {
  const minGap = options.minGapMinutes ?? PUBLISH_LIMITS.minGapMinutes;
  const out: Date[] = [];
  for (let i = 0; i < options.overdueCount; i++) {
    out.push(new Date(options.now.getTime() + (i + 1) * minGap * 60_000));
  }
  return out;
}

/** How many posts the current edition still needs. */
export function editionRemaining(input: {
  edition: Edition;
  publishedToday: number;
  scheduledToday: number;
}): number {
  const cumulative: Record<Edition, number> = {
    morning: EDITION_TARGETS.morning,
    midday: EDITION_TARGETS.morning + EDITION_TARGETS.midday,
    evening: PUBLISH_LIMITS.maxPerDay,
  };
  const target = cumulative[input.edition];
  return Math.max(0, Math.min(target - input.publishedToday - input.scheduledToday, PUBLISH_LIMITS.maxPerDay));
}

/** Word target per edition — controls both prompt length and completeness scoring. */
export function wordTargetFor(edition: Edition): number {
  switch (edition) {
    case "morning":
      return 320;
    case "midday":
      return 620;
    default:
      return 1100;
  }
}

/** Style instruction handed to the writer for each edition. */
export function angleFor(edition: Edition): string {
  switch (edition) {
    case "morning":
      return "fast, factual morning brief: the essentials plus the one detail readers need to understand it";
    case "midday":
      return "midday explainer: what is gaining attention, why it matters, and what to watch next";
    default:
      return "evening analysis: background, competing interpretations, timeline where relevant, and what happens next";
  }
}
