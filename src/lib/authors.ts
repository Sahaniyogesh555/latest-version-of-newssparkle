// Author registry. Article `author` field (string) is matched against `name`.
// If no match, a generated fallback profile is returned.

export interface AuthorProfile {
  slug: string;
  name: string;
  role: string;
  beat: string;
  bio: string;
  image: string; // Professional author avatar crop
  imageMd?: string; // Medium responsive size (300x300)
  imageSm?: string; // Small responsive size (150x150)
  imageLg?: string; // Large responsive size (400x400)
  twitter?: string;
  email?: string;
}

const authorImage = (slug: string) => ({
  full: `/authors/${slug}.png`,
  lg: `/authors/${slug}-lg.png`,
  md: `/authors/${slug}-md.png`,
  sm: `/authors/${slug}-sm.png`,
});

export const AUTHORS: AuthorProfile[] = [
  {
    slug: "editorial-desk",
    name: "NewsSparkle Editorial Desk",
    role: "Lead Newsroom",
    beat: "Breaking news, daily briefings, story coordination",
    bio: "The central editorial desk that coordinates daily coverage, sets the news agenda, and signs off on every story before publication. Operates under our published Editorial Policy.",
    ...authorImage("editorial-desk"),
    image: authorImage("editorial-desk").full,
    imageMd: authorImage("editorial-desk").md,
    imageSm: authorImage("editorial-desk").sm,
    imageLg: authorImage("editorial-desk").lg,
  },
  {
    slug: "politics-desk",
    name: "Politics & Policy Desk",
    role: "Senior Reporters",
    beat: "Government, elections, public policy, international affairs",
    bio: "Covers legislative developments, electoral politics, executive actions and global diplomacy. Sources draw from official records, court filings and on-the-record interviews.",
    ...authorImage("politics-desk"),
    image: authorImage("politics-desk").full,
    imageMd: authorImage("politics-desk").md,
    imageSm: authorImage("politics-desk").sm,
    imageLg: authorImage("politics-desk").lg,
  },
  {
    slug: "business-desk",
    name: "Business & Markets Desk",
    role: "Senior Analysts",
    beat: "Economy, markets, corporate news, jobs",
    bio: "Tracks listed-company filings, central-bank communications and macro indicators. Specialises in turning raw market data into clear, contextual reporting.",
    ...authorImage("business-desk"),
    image: authorImage("business-desk").full,
    imageMd: authorImage("business-desk").md,
    imageSm: authorImage("business-desk").sm,
    imageLg: authorImage("business-desk").lg,
  },
  {
    slug: "technology-desk",
    name: "Technology & AI Desk",
    role: "Specialist Reporters",
    beat: "Software, AI research, product launches, cyber-security",
    bio: "Reports on the products, papers and platform shifts shaping the technology industry. Cross-references vendor announcements with independent benchmarks.",
    ...authorImage("technology-desk"),
    image: authorImage("technology-desk").full,
    imageMd: authorImage("technology-desk").md,
    imageSm: authorImage("technology-desk").sm,
    imageLg: authorImage("technology-desk").lg,
  },
  {
    slug: "health-desk",
    name: "Health & Lifestyle Desk",
    role: "Health Reporters",
    beat: "Medicine, public health, fitness, nutrition, wellbeing",
    bio: "Sources stories from peer-reviewed journals, public-health authorities and credentialed clinicians. Flags ongoing research as preliminary where appropriate.",
    ...authorImage("health-desk"),
    image: authorImage("health-desk").full,
    imageMd: authorImage("health-desk").md,
    imageSm: authorImage("health-desk").sm,
    imageLg: authorImage("health-desk").lg,
  },
  {
    slug: "entertainment-desk",
    name: "Entertainment & Culture Desk",
    role: "Culture Writers",
    beat: "Film, television, music, viral trends, celebrity",
    bio: "Covers the cultural moments that shape conversation. Distinguishes confirmed news from rumour and labels opinion content explicitly.",
    ...authorImage("entertainment-desk"),
    image: authorImage("entertainment-desk").full,
    imageMd: authorImage("entertainment-desk").md,
    imageSm: authorImage("entertainment-desk").sm,
    imageLg: authorImage("entertainment-desk").lg,
  },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fallback avatar generator for unknown authors
const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ea580c,2563eb,16a34a,7c3aed,0d9488,db2777&backgroundType=gradientLinear&fontWeight=700`;

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
