// Safety and trust gate.
//
// Runs BEFORE anything reaches the quality scorer and again right before
// publication. It looks for content that must never be published automatically:
// incitement, explicit material, self-harm instructions, medical/financial
// false promises, conspiracy framing, and low-quality AI/SEO spam.
//
// These are pattern checks, not a judge: they exist to stop obvious unsafe or
// spammy output and to force it into the human review queue. The verification
// pass in the rewrite pipeline covers factual grounding separately.

import { normalizeWhitespace } from "./text.ts";
import type { SafetyFlag, SafetyReport } from "./types.ts";

interface Pattern {
  code: string;
  severity: "warning" | "critical";
  detail: string;
  pattern: RegExp;
}

/** Advocacy / incitement — the wording that turns a topic into a violation. */
const ADVOCACY_PATTERNS: Pattern[] = [
  {
    code: "incitement",
    severity: "critical",
    detail: "Calls for violence against a group",
    pattern: /\b(?:should|must|need to|ought to)\s+(?:all\s+)?be\s+(?:killed|exterminated|eliminated|wiped out)\b|\bkill all\b|\bdeath to (?:all|the)\b/i,
  },
  {
    code: "hate-generalisation",
    severity: "critical",
    detail: "Generalises criminality or subhumanity to a group",
    pattern: /\b(?:all|every)\s+\w+\s+(?:are|is)\s+(?:criminals|rapists|animals|vermin|subhuman|terrorists)\b/i,
  },
  {
    code: "self-harm-instructions",
    severity: "critical",
    detail: "Self-harm method or instruction",
    pattern: /\b(?:how to|best way to|methods? (?:of|for))\s+(?:kill yourself|commit suicide|self[- ]harm)\b/i,
  },
  {
    code: "explicit-content",
    severity: "critical",
    detail: "Explicit sexual description",
    pattern: /\b(?:explicit|graphic)\s+(?:sex|sexual|pornographic)\s+(?:scene|act|video|images?)\b/i,
  },
  {
    code: "exploitation",
    severity: "critical",
    detail: "Sexualisation of minors",
    pattern: /\b(?:minor|child|underage|teen)\w*\s+(?:sex|sexual|nude|porn)\b/i,
  },
];

/** Unsafe factual claims that must never ship unattended. */
const CLAIM_PATTERNS: Pattern[] = [
  {
    code: "medical-misinformation",
    severity: "critical",
    detail: "Miracle cure or anti-vaccine claim",
    pattern: /\b(?:miracle|miraculous|secret)\s+cure\b|\bcures? (?:cancer|diabetes|autism|all diseases)\b|\bvaccines? cause\b|\bcancer cure (?:found|discovered)\b/i,
  },
  {
    code: "financial-promise",
    severity: "critical",
    detail: "Guaranteed-return or pump-style claim",
    pattern: /\bguaranteed\s+(?:returns?|profits?|income)\b|\bdouble your money\b|\bcan'?t lose\b|\bwill (?:10|100|1000)x\b|\bget rich quick\b/i,
  },
  {
    code: "medical-advice",
    severity: "critical",
    detail: "Tells readers to change or stop medical treatment",
    pattern:
      /\b(?:you|people|patients|readers|everyone|anyone)\s+should\s+(?:stop|quit|start|avoid|skip|not)\s+(?:taking|using|getting|taking your)\b|\b(?:stop|quit) taking your (?:medication|medicine|pills|insulin|antibiotics|statins)\b|\bskip (?:your )?(?:vaccine|vaccination|medication|treatment|dose)\b/i,
  },
  {
    code: "defamation-risk",
    severity: "critical",
    detail: "Unattributed criminal allegation about a named subject",
    pattern:
      /\b(?:sources? (?:claim|say|suggest|allege)|rumou?rs? (?:say|suggest|claim)|unconfirmed reports?)\b[\s\S]{0,90}?\b(?:fled|embezzled|stole|stolen|bribed|assaulted|abused|rigged|laundered|smuggled|blackmailed)\b|\b(?:secretly|allegedly)\s+(?:fled|embezzled|stole|bribed|smuggled)\b/i,
  },
  {
    code: "unverified-rumour",
    severity: "warning",
    detail: "Rumour or unattributed sourcing language",
    pattern:
      /\b(?:rumou?rs?|unconfirmed reports?|sources? (?:claim|say|said|suggest|allege)|it is being said|word on the street|no official has confirmed)\b/i,
  },
  {
    code: "fabrication-marker",
    severity: "warning",
    detail: "Unverifiable insider framing",
    pattern: /\b(?:scientists? are baffled|doctors hate|they don'?t want you to know|mainstream media (?:won'?t|will not) (?:tell|report)|secretly controlled|hidden truth|the real reason they)\b/i,
  },
  {
    code: "election-deception",
    severity: "critical",
    detail: "Voting misinformation pattern",
    pattern: /\b(?:vote|voting)\s+(?:by|via)\s+(?:text|whatsapp|email)\b|\belection (?:was|is) (?:rigged|cancelled)\b(?!.{0,40}\b(?:alleged|claimed|according to)\b)/i,
  },
];

/** Detected in ingested feed items and drafts alike. */
const SPAM_PATTERNS: Pattern[] = [
  { code: "spam", severity: "warning", detail: "Commercial pitch", pattern: /\b(?:buy now|limited offer|discount code|coupon|sponsored post|affiliate link|shop now)\b/i },
  { code: "spam", severity: "warning", detail: "SEO bait", pattern: /\b(?:click here|read more at|subscribe to my)\b/i },
  { code: "spam", severity: "warning", detail: "Link dump", pattern: /(?:https?:\/\/\S+\s*){4,}/i },
  { code: "spam", severity: "warning", detail: "Contact solicitation", pattern: /\b(?:whatsapp|telegram)\s*(?:\+|number|me)\b/i },
];

const CLICKBAIT_PATTERNS: RegExp[] = [
  /\byou won'?t believe\b/i,
  /\bshocking(?:ly)?\b/i,
  /\bmust[- ]see\b/i,
  /\bthis (?:one|simple) (?:weird )?(?:trick|thing)\b/i,
  /\bwhat happened next\b/i,
  /\bwill blow your mind\b/i,
  /\b(?:number|#)\s?\d+\s+will\b/i,
  /\bnobody (?:is )?talking about\b/i,
  /\bhere'?s why\b.*\b(?:everyone|nobody)\b/i,
];

export interface SafetyScanOptions {
  /** Headline-only scanning (used for feed items before we have a body). */
  titleOnly?: boolean;
}

export function isClickbait(title: string): boolean {
  const clean = normalizeWhitespace(title);
  if (CLICKBAIT_PATTERNS.some((p) => p.test(clean))) return true;

  // ALL-CAPS shouting (ignore short acronyms and known initialisms).
  const words = clean.split(/\s+/).filter((w) => w.replace(/[^A-Za-z]/g, "").length > 2);
  const shouting = words.filter((w) => w === w.toUpperCase() && /[A-Z]{3,}/.test(w));
  if (words.length >= 4 && shouting.length / words.length > 0.3) return true;

  // Stacked exclamation marks are a reliable spam signal.
  return /!{2,}/.test(clean) || /!/.test(clean) && /\?/.test(clean) && clean.length < 45;
}

/**
 * Claim patterns that must be scanned even from a headline alone: the ones that
 * describe harm to a person (medical advice, criminal allegations).
 */
const HEADLINE_CLAIM_CODES = new Set([
  "medical-misinformation",
  "medical-advice",
  "financial-promise",
  "defamation-risk",
  "election-deception",
]);

export function scanSafety(text: string, options: SafetyScanOptions = {}): SafetyReport {
  const clean = normalizeWhitespace(text);
  const flags: SafetyFlag[] = [];
  const claimPatterns = options.titleOnly
    ? CLAIM_PATTERNS.filter((p) => HEADLINE_CLAIM_CODES.has(p.code))
    : CLAIM_PATTERNS;
  const groups = [ADVOCACY_PATTERNS, claimPatterns, SPAM_PATTERNS];

  for (const group of groups) {
    for (const pattern of group) {
      const match = clean.match(pattern.pattern);
      if (!match) continue;
      if (flags.some((f) => f.code === pattern.code && f.detail === pattern.detail)) continue;
      flags.push({
        code: pattern.code,
        severity: pattern.severity,
        detail: pattern.detail,
        match: match[0].slice(0, 80),
      });
    }
  }

  const clickbait = isClickbait(clean);
  if (clickbait) {
    flags.push({ code: "clickbait", severity: "warning", detail: "Headline uses clickbait framing" });
  }

  return {
    safe: !flags.some((f) => f.severity === "critical"),
    flags,
    clickbait,
  };
}

/** Merge several safety reports (e.g. headline + body scans). */
export function mergeSafetyReports(...reports: SafetyReport[]): SafetyReport {
  const flags = reports.flatMap((r) => r.flags);
  const seen = new Set<string>();
  const deduped = flags.filter((f) => {
    const key = `${f.code}:${f.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    safe: !deduped.some((f) => f.severity === "critical"),
    flags: deduped,
    clickbait: reports.some((r) => r.clickbait),
  };
}

/** Short human-readable summary for alerts and the pipeline report. */
export function summarizeSafety(report: SafetyReport): string {
  if (report.flags.length === 0) return "clean";
  return report.flags
    .map((f) => `${f.severity}:${f.code}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}
