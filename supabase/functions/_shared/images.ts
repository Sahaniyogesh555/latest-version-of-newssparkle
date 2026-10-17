// Featured-image automation.
//
// Rules that keep the site looking deliberate without a human in the loop:
//   * Never ship a story without an image — the cascade always terminates in a
//     deterministic placeholder seeded by the slug.
//   * Prefer licensed APIs, keep the credit line the licence requires, and
//     fall back to keyword-matched stock rather than a random photo.
//   * Ask for WebP (or the provider's modern-format parameter) and a fixed
//     16:9 width so layout shift and page weight stay predictable.
//   * Alt text is descriptive; if the model returns nothing usable, fall back
//     to a neutral description of the story, never the bare headline repeated.
//
// Network calls live at the bottom and are injectable for tests.

import { guardedFetch } from "./retry.ts";
import { truncateAtWord } from "./text.ts";
import type { CategorySlug } from "./types.ts";

export interface ImageCandidate {
  url: string;
  provider: "unsplash" | "pexels" | "stock" | "fallback";
  width?: number;
  height?: number;
  credit?: string;
  creditUrl?: string;
  /** Provider id, useful for logs and de-duplication. */
  id?: string;
}

export interface ResolvedImage {
  url: string;
  alt: string;
  credit: string | null;
  creditUrl: string | null;
  provider: ImageCandidate["provider"];
  /** True when only the placeholder was available. */
  placeholder: boolean;
}

export const IMAGE_RULES = {
  targetWidth: 1600,
  targetHeight: 900,
  /** Minimum acceptable width for a hero image. */
  minWidth: 900,
  /** Stock queries are built from the headline, capped to keep them focused. */
  maxQueryTerms: 6,
  /** Placeholder images are always available, so this is a hard ceiling. */
  maxCandidatesPerProvider: 8,
} as const;

/** Strip filler so a headline becomes a usable stock search phrase. */
export function imageQueryFor(title: string, category?: string | null): string {
  const stop = new Set([
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "as", "at", "by",
    "after", "before", "over", "under", "says", "say", "said", "will", "could", "may", "new",
    "amid", "into", "from", "that", "this", "its", "his", "her", "their", "how", "why", "what",
  ]);
  const terms = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word))
    .slice(0, IMAGE_RULES.maxQueryTerms);
  if (terms.length === 0 && category) terms.push(category.replace(/-/g, " "));
  return terms.join(" ");
}

/** Provider URLs, built once so tests can assert on the shape. */
export function unsplashSearchUrl(query: string, accessKey: string): string {
  const params = new URLSearchParams({
    query,
    per_page: String(IMAGE_RULES.maxCandidatesPerProvider),
    orientation: "landscape",
    client_id: accessKey,
  });
  return `https://api.unsplash.com/search/photos?${params.toString()}`;
}

export function pexelsSearchUrl(query: string, apiKey: string): string {
  const params = new URLSearchParams({
    query,
    per_page: String(IMAGE_RULES.maxCandidatesPerProvider),
    orientation: "landscape",
  });
  return `https://api.pexels.com/v1/search?${params.toString()}`;
}

/** Deterministic placeholder: the same slug always gets the same image. */
export function fallbackImageUrl(slug: string): string {
  const seed = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60) || "news";
  return `https://picsum.photos/seed/${seed}/${IMAGE_RULES.targetWidth}/${IMAGE_RULES.targetHeight}`;
}

/** Ask the provider for WebP (Unsplash: fm=webp, Pexels: auto=compress). */
export function modernFormatUrl(url: string, provider: ImageCandidate["provider"]): string {
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (provider === "unsplash") {
      parsed.searchParams.set("fm", "webp");
      parsed.searchParams.set("w", String(IMAGE_RULES.targetWidth));
      parsed.searchParams.set("q", "80");
    } else if (provider === "pexels") {
      parsed.searchParams.set("auto", "compress");
      parsed.searchParams.set("cs", "tinysrgb");
      parsed.searchParams.set("fm", "webp");
      parsed.searchParams.set("w", String(IMAGE_RULES.targetWidth));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return false;
  // Reject obvious placeholders left behind by earlier pipelines.
  return !/(?:placeholder|broken|missing|1x1|spacer)\.(?:png|jpe?g|gif|webp)/i.test(url);
}

/** Choose the best candidate: biggest usable image, licensed providers first. */
export function pickFeaturedImage(candidates: ImageCandidate[]): ImageCandidate | null {
  const usable = candidates.filter((candidate) => isUsableImageUrl(candidate.url));
  if (usable.length === 0) return null;
  const ranked = [...usable].sort((a, b) => {
    const providerRank = providerOrder(a.provider) - providerOrder(b.provider);
    if (providerRank !== 0) return providerRank;
    return (b.width ?? 0) - (a.width ?? 0);
  });
  return ranked.find((candidate) => (candidate.width ?? IMAGE_RULES.minWidth) >= IMAGE_RULES.minWidth) ?? ranked[0];
}

function providerOrder(provider: ImageCandidate["provider"]): number {
  switch (provider) {
    case "unsplash":
      return 0;
    case "pexels":
      return 1;
    case "stock":
      return 2;
    default:
      return 3;
  }
}

export interface AltTextInput {
  title: string;
  category?: string | null;
  /** Model-written alt text, if the AI layer produced something usable. */
  generated?: string | null;
}

/**
 * Alt text for the hero image. Prefers the model's description, then a
 * category-aware fallback. Never returns an empty string.
 */
export function altTextFor(input: AltTextInput): string {
  const generated = (input.generated ?? "").trim().replace(/\s+/g, " ");
  if (generated.length >= 12) return truncateAtWord(generated, 125);

  const words = input.title
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .slice(0, 10)
    .join(" ");
  const section = (input.category ?? "news").replace(/-/g, " ");
  return truncateAtWord(`${section} illustration: ${words}`.trim(), 125);
}

/** Assemble the final image record, guaranteeing a usable URL and alt text. */
export function resolveFeaturedImage(input: {
  slug: string;
  title: string;
  category?: string | null;
  candidates: ImageCandidate[];
  generatedAlt?: string | null;
  /** Existing stored image: kept when it is still valid (no re-fetch needed). */
  existingUrl?: string | null;
  existingCredit?: string | null;
  existingCreditUrl?: string | null;
}): ResolvedImage {
  if (isUsableImageUrl(input.existingUrl)) {
    return {
      url: input.existingUrl as string,
      alt: altTextFor({ title: input.title, category: input.category, generated: input.generatedAlt }),
      credit: input.existingCredit ?? null,
      creditUrl: input.existingCreditUrl ?? null,
      provider: "stock",
      placeholder: false,
    };
  }

  const picked = pickFeaturedImage(input.candidates);
  if (!picked) {
    return {
      url: fallbackImageUrl(input.slug),
      alt: altTextFor({ title: input.title, category: input.category, generated: input.generatedAlt }),
      credit: "Placeholder image",
      creditUrl: null,
      provider: "fallback",
      placeholder: true,
    };
  }

  return {
    url: modernFormatUrl(picked.url, picked.provider),
    alt: altTextFor({ title: input.title, category: input.category, generated: input.generatedAlt }),
    credit: picked.credit ?? null,
    creditUrl: picked.creditUrl ?? null,
    provider: picked.provider,
    placeholder: false,
  };
}

/** Replace a hero image that has stopped loading, keeping the story as-is. */
export function replacementImageFor(slug: string, title: string, category?: CategorySlug | string | null): ResolvedImage {
  return {
    url: fallbackImageUrl(slug),
    alt: altTextFor({ title, category: category as string | null }),
    credit: "Placeholder image",
    creditUrl: null,
    provider: "fallback",
    placeholder: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

export interface ImageProviderConfig {
  unsplashAccessKey?: string | null;
  pexelsApiKey?: string | null;
}

export function imageProvidersFromEnv(getenv: (key: string) => string | undefined): ImageProviderConfig {
  return {
    unsplashAccessKey: getenv("UNSPLASH_ACCESS_KEY") ?? null,
    pexelsApiKey: getenv("PEXELS_API_KEY") ?? null,
  };
}

interface UnsplashPhoto {
  id?: string;
  width?: number;
  height?: number;
  urls?: { raw?: string; regular?: string; full?: string };
  user?: { name?: string; links?: { html?: string } };
}

export function parseUnsplashResponse(payload: unknown): ImageCandidate[] {
  const results = (payload as { results?: UnsplashPhoto[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((photo): ImageCandidate | null => {
      const url = photo.urls?.regular ?? photo.urls?.full ?? photo.urls?.raw;
      if (!url) return null;
      return {
        url,
        provider: "unsplash" as const,
        width: photo.width,
        height: photo.height,
        credit: photo.user?.name ? `Photo: ${photo.user.name} / Unsplash` : "Photo: Unsplash",
        creditUrl: photo.user?.links?.html ?? "https://unsplash.com",
        id: photo.id,
      };
    })
    .filter((candidate): candidate is ImageCandidate => candidate !== null);
}

interface PexelsPhoto {
  id?: number;
  width?: number;
  height?: number;
  src?: { large2x?: string; large?: string; original?: string };
  photographer?: string;
  photographer_url?: string;
  url?: string;
}

export function parsePexelsResponse(payload: unknown): ImageCandidate[] {
  const photos = (payload as { photos?: PexelsPhoto[] } | null)?.photos;
  if (!Array.isArray(photos)) return [];
  return photos
    .map((photo): ImageCandidate | null => {
      const url = photo.src?.large2x ?? photo.src?.large ?? photo.src?.original;
      if (!url) return null;
      return {
        url,
        provider: "pexels" as const,
        width: photo.width,
        height: photo.height,
        credit: photo.photographer ? `Photo: ${photo.photographer} / Pexels` : "Photo: Pexels",
        creditUrl: photo.photographer_url ?? photo.url ?? "https://pexels.com",
        id: photo.id !== undefined ? String(photo.id) : undefined,
      };
    })
    .filter((candidate): candidate is ImageCandidate => candidate !== null);
}

/**
 * Walk the cascade and return whatever is available.
 * Providers are tried in licence-quality order; failures are swallowed because
 * the caller always has the deterministic placeholder as a final answer.
 */
export async function fetchImageCandidates(
  query: string,
  config: ImageProviderConfig,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ImageCandidate[]> {
  const candidates: ImageCandidate[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;

  if (config.unsplashAccessKey) {
    try {
      const response = await guardedFetch(unsplashSearchUrl(query, config.unsplashAccessKey), {
        fetchImpl,
        attempts: 2,
        headers: { Accept: "application/json" },
      });
      if (response.ok) candidates.push(...parseUnsplashResponse(await response.json()));
    } catch {
      // fall through to the next provider
    }
  }

  if (config.pexelsApiKey) {
    try {
      const response = await guardedFetch(pexelsSearchUrl(query, config.pexelsApiKey), {
        fetchImpl,
        attempts: 2,
        headers: { Authorization: config.pexelsApiKey, Accept: "application/json" },
      });
      if (response.ok) candidates.push(...parsePexelsResponse(await response.json()));
    } catch {
      // fall through to the placeholder
    }
  }

  return candidates;
}

/** Lightweight reachability check used by the maintenance sweep. */
export async function imageReachable(url: string, options: { fetchImpl?: typeof fetch } = {}): Promise<boolean> {
  if (!isUsableImageUrl(url)) return false;
  try {
    const response = await guardedFetch(url, { fetchImpl: options.fetchImpl, attempts: 1, timeoutMs: 8_000 });
    return response.ok;
  } catch {
    return false;
  }
}
