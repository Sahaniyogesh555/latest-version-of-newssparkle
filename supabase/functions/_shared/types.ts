// Shared value types for the autonomous newsroom.
// Kept free of Deno/network APIs so the logic can be unit tested from Node.

export type CategorySlug =
  | "breaking-news"
  | "world"
  | "politics"
  | "business"
  | "technology"
  | "health"
  | "entertainment"
  | "sports";

export const CATEGORY_SLUGS: CategorySlug[] = [
  "breaking-news",
  "world",
  "politics",
  "business",
  "technology",
  "health",
  "entertainment",
  "sports",
];

export type Edition = "morning" | "midday" | "evening";
export type PostStatus = "draft" | "review" | "scheduled" | "published" | "rejected" | "archived";

export interface SourceFeedItem {
  title: string;
  url?: string;
  snippet?: string;
  published?: string;
  sourceName: string;
  trustTier?: 1 | 2 | 3;
  categoryHint?: string | null;
}

export interface RejectedItem {
  title: string;
  reason: string;
}

export interface ClassificationResult {
  slug: CategorySlug;
  confidence: number;
  method: "lexicon" | "source-hint" | "trend" | "fallback";
  scores: Record<string, number>;
  alternates: Array<{ slug: string; score: number }>;
}

export interface SafetyFlag {
  code: string;
  severity: "info" | "warning" | "critical";
  detail: string;
  match?: string;
}

export interface SafetyReport {
  safe: boolean;
  flags: SafetyFlag[];
  clickbait: boolean;
}

export interface StructureReport {
  ok: boolean;
  wordCount: number;
  paragraphs: number;
  h2: number;
  h3: number;
  lists: number;
  links: number;
  issues: string[];
}

export interface GroundingReport {
  score: number; // 0..1
  numbersTotal: number;
  numbersUnsupported: string[];
  entitiesTotal: number;
  entitiesUnsupported: string[];
  notes: string[];
}

export interface PlagiarismReport {
  maxRunLength: number;
  overlapRatio: number; // share of draft n-grams found verbatim in a source
  risky: boolean;
  worstSource?: string;
}

export interface VerificationVerdict {
  /** Verdict from the model's own review pass, if available. */
  modelConfidence?: number;
  modelSupported?: boolean;
  modelNotes?: string;
}

export interface QualityInput {
  title: string;
  excerpt: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  faq?: Array<{ q: string; a: string }>;
  keyTakeaways?: string[];
  targetWords?: number;
  sources?: SourceFeedItem[];
  classification?: ClassificationResult;
  safety?: SafetyReport;
  structure?: StructureReport;
  grounding?: GroundingReport;
  plagiarism?: PlagiarismReport;
  duplicationRisk?: number; // 0..1, 1 = near duplicate of an existing post
  verification?: VerificationVerdict;
}

export interface QualityBreakdown {
  completeness: number;
  readability: number;
  structure: number;
  seo: number;
  trust: number;
  factual: number;
  originality: number;
}

export interface QualityReport {
  score: number; // 0..100
  verdict: "publish" | "review" | "reject";
  breakdown: QualityBreakdown;
  /** Hard stops: the draft is rejected outright. */
  blockingReasons: string[];
  /**
   * Concerns that force human review instead of publication even when the score
   * is high (an unverifiable draft is held, not thrown away).
   */
  reviewReasons: string[];
  warnings: string[];
}
