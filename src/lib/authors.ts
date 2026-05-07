// Author registry. Article `author` field (string) is matched against `name`.
// If no match, a generated fallback profile is returned.

export interface AuthorProfile {
  slug: string;
  name: string;
  role: string;
  beat: string;
  bio: string;
  image: string; // dicebear avatar (lightweight, deterministic)
  twitter?: string;
  email?: string;
}

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ea580c,2563eb,16a34a,7c3aed,0d9488,db2777&backgroundType=gradientLinear&fontWeight=700`;

export const AUTHORS: AuthorProfile[] = [
  {
    slug: "editorial-desk",
    name: "NewsSparkle Editorial Desk",
    role: "Lead Newsroom",
    beat: "Breaking news, daily briefings, story coordination",
    bio: "The central editorial desk that coordinates daily coverage, sets the news agenda, and signs off on every story before publication. Operates under our published Editorial Policy.",
    image: avatar("NewsSparkle Editorial"),
  },
  {
    slug: "politics-desk",
    name: "Politics & Policy Desk",
    role: "Senior Reporters",
    beat: "Government, elections, public policy, international affairs",
    bio: "Covers legislative developments, electoral politics, executive actions and global diplomacy. Sources draw from official records, court filings and on-the-record interviews.",
    image: avatar("Politics Policy"),
  },
  {
    slug: "business-desk",
    name: "Business & Markets Desk",
    role: "Senior Analysts",
    beat: "Economy, markets, corporate news, jobs",
    bio: "Tracks listed-company filings, central-bank communications and macro indicators. Specialises in turning raw market data into clear, contextual reporting.",
    image: avatar("Business Markets"),
  },
  {
    slug: "technology-desk",
    name: "Technology & AI Desk",
    role: "Specialist Reporters",
    beat: "Software, AI research, product launches, cyber-security",
    bio: "Reports on the products, papers and platform shifts shaping the technology industry. Cross-references vendor announcements with independent benchmarks.",
    image: avatar("Technology AI"),
  },
  {
    slug: "health-desk",
    name: "Health & Lifestyle Desk",
    role: "Health Reporters",
    beat: "Medicine, public health, fitness, nutrition, wellbeing",
    bio: "Sources stories from peer-reviewed journals, public-health authorities and credentialed clinicians. Flags ongoing research as preliminary where appropriate.",
    image: avatar("Health Lifestyle"),
  },
  {
    slug: "entertainment-desk",
    name: "Entertainment & Culture Desk",
    role: "Culture Writers",
    beat: "Film, television, music, viral trends, celebrity",
    bio: "Covers the cultural moments that shape conversation. Distinguishes confirmed news from rumour and labels opinion content explicitly.",
    image: avatar("Entertainment Culture"),
  },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function findAuthor(name: string | undefined | null): AuthorProfile {
  if (!name) return AUTHORS[0];
  const match =
    AUTHORS.find(a => a.name.toLowerCase() === name.toLowerCase()) ||
    AUTHORS.find(a => slugify(a.name) === slugify(name));
  if (match) return match;
  return {
    slug: slugify(name) || "editorial-desk",
    name,
    role: "Contributing Reporter",
    beat: "General assignment",
    bio: `${name} contributes reporting to NewsSparkle under editorial review.`,
    image: avatar(name),
  };
}

export function findAuthorBySlug(slug: string): AuthorProfile | undefined {
  return AUTHORS.find(a => a.slug === slug);
}
