// Failure recovery primitives: backoff, circuit breakers, guarded fetches.
//
// The newsroom runs unattended, so every outbound dependency (feeds, AI
// gateway, image APIs, Supabase) needs a bounded retry and a way to stop
// hammering something that is clearly down.

export interface BackoffOptions {
  baseMs?: number;
  factor?: number;
  maxMs?: number;
  /** 0..1 — jitter proportion applied deterministically per attempt. */
  jitter?: number;
  seed?: string;
}

/** Exponential backoff, capped, with optional jitter. */
export function backoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 2_000, factor = 2, maxMs = 5 * 60_000, jitter = 0.2, seed = "retry" } = options;
  const raw = Math.min(maxMs, baseMs * Math.pow(factor, Math.max(0, attempt - 1)));
  if (jitter <= 0) return Math.round(raw);
  const noise = deterministicNoise(`${seed}:${attempt}`);
  return Math.round(raw * (1 - jitter + noise * jitter * 2));
}

/** Small deterministic PRNG output in 0..1 (keeps tests reproducible). */
function deterministicNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface RetryOptions extends BackoffOptions {
  attempts?: number;
  /** Return false to stop retrying (e.g. 401/404). */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastError: unknown,
  ) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Run `fn`, retrying with exponential backoff until it succeeds or gives up. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === attempts) break;
      const delay = backoffDelay(attempt, options);
      options.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw new RetryExhaustedError(
    `failed after ${attempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    attempts,
    lastError,
  );
}

/* -------------------------------------------------------------------------- */
/* Circuit breaker                                                            */
/* -------------------------------------------------------------------------- */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  /** Consecutive failures before the breaker opens. */
  threshold?: number;
  /** How long to stay open before allowing a probe. */
  cooldownMs?: number;
  /** Successful probes needed to close again. */
  halfOpenSuccesses?: number;
}

/**
 * Stops the pipeline from repeatedly calling a dependency that is failing.
 * Open = skip immediately; half-open = allow exactly one probe.
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private openedAt: number | null = null;
  /** Explicit override set by trip(); cleared on the next real failure. */
  private openUntilOverride: number | null = null;

  constructor(private readonly options: BreakerOptions = {}) {}

  private get threshold(): number {
    return this.options.threshold ?? 3;
  }

  private get cooldownMs(): number {
    return this.options.cooldownMs ?? 15 * 60_000;
  }

  private get halfOpenSuccesses(): number {
    return this.options.halfOpenSuccesses ?? 1;
  }

  private openUntil(): number | null {
    if (this.openUntilOverride !== null) return this.openUntilOverride;
    return this.openedAt === null ? null : this.openedAt + this.cooldownMs;
  }

  state(now: number = Date.now()): BreakerState {
    const until = this.openUntil();
    if (until === null) return "closed";
    return now >= until ? "half-open" : "open";
  }

  canAttempt(now: number = Date.now()): boolean {
    return this.state(now) !== "open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.successes++;
    if (this.state() === "half-open" && this.successes >= this.halfOpenSuccesses) {
      this.openedAt = null;
      this.openUntilOverride = null;
      this.successes = 0;
    }
  }

  recordFailure(now: number = Date.now()): void {
    this.failures++;
    this.successes = 0;
    if (this.failures >= this.threshold) {
      this.openedAt = now;
      this.openUntilOverride = null;
    }
  }

  /** Consecutive failures — surfaced in source-health alerts. */
  get consecutiveFailures(): number {
    return this.failures;
  }

  /** Force-open the breaker until an explicit timestamp (e.g. a parked feed). */
  trip(until: number, now: number = Date.now()): void {
    this.openedAt = now;
    this.openUntilOverride = until;
    this.failures = Math.max(this.failures, this.threshold);
  }
}

/* -------------------------------------------------------------------------- */
/* Guarded fetch                                                              */
/* -------------------------------------------------------------------------- */

export interface GuardedFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  attempts?: number;
  shouldRetryStatus?: (status: number) => boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly bodySnippet: string,
  ) {
    super(`HTTP ${status} for ${url}${bodySnippet ? ` — ${bodySnippet.slice(0, 160)}` : ""}`);
    this.name = "HttpError";
  }
}

export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);

/**
 * fetch with a timeout, bounded retries and status-based retry policy.
 * Returns the Response — callers decide how to parse it.
 */
export async function guardedFetch(url: string, options: GuardedFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 12_000,
    headers = {},
    attempts = 3,
    shouldRetryStatus = isRetryableStatus,
    fetchImpl = fetch,
  } = options;

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      try {
        const response = await fetchImpl(url, {
          headers: { "User-Agent": "NewsSparkle-Newsroom/1.0 (+https://newssparkle.lovable.app)", ...headers },
          signal: controller.signal,
          redirect: "follow",
        });
        if (!response.ok && shouldRetryStatus(response.status)) {
          const body = await response.text().catch(() => "");
          throw new HttpError(response.status, url, body);
        }
        return response;
      } finally {
        clearTimeout(timer);
      }
    },
    {
      attempts,
      seed: url,
      shouldRetry: (error) => {
        if (error instanceof HttpError) return shouldRetryStatus(error.status);
        return true; // network/timeout errors are always worth one more try
      },
    },
  );
}

/** Split a list into fixed-size batches (bounds DB round-trips and bursts). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Minimal concurrency limiter so a wide fan-out cannot exhaust sockets. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
