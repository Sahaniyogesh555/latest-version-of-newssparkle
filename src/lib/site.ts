export const SITE = {
  name: "NewsSparkle",
  tagline: "Your daily briefing on what actually matters.",
  description: "Your daily briefing on what matters — breaking news, politics, tech, business, health and entertainment. Handpicked, fact-checked, and refreshingly readable.",
  // Canonical host. Override per environment with VITE_SITE_URL (deploy previews,
  // staging, local). Never derive this from window.location — canonicals, OG
  // URLs and JSON-LD @ids must be stable regardless of who is visiting.
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://newssparkle.lovable.app",
  twitter: "@newssparkle",
  publisher: "NewsSparkle Editorial Desk",
  logo: "/logo.png",
  // TODO: replace with your contact Gmail before AdSense submission
  email: "contact.newssparkle@gmail.com",
  // TODO: replace with your real ID after AdSense approval (also update public/ads.txt + index.html script)
  adsensePublisherId: "ca-pub-XXXXXXXXXXXXXXXX",
};

export const CATEGORIES = [
  {
    slug: "breaking-news",
    name: "Breaking News",
    color: "cat-breaking",
    description: "Real-time alerts, major developments, and urgent stories as they happen.",
  },
  {
    slug: "politics",
    name: "Politics & Government",
    color: "cat-politics",
    description: "Elections, policy, legislation and the people who shape them.",
  },
  {
    slug: "business",
    name: "Business & Economy",
    color: "cat-business",
    description: "Markets, companies, jobs and the forces moving the global economy.",
  },
  {
    slug: "technology",
    name: "Technology & AI",
    color: "cat-technology",
    description: "Artificial intelligence, products, cybersecurity and the industry behind them.",
  },
  {
    slug: "health",
    name: "Health & Lifestyle",
    color: "cat-health",
    description: "Medical research, public health and evidence-based wellbeing reporting.",
  },
  {
    slug: "entertainment",
    name: "Entertainment & Trending",
    color: "cat-entertainment",
    description: "Film, music, streaming, culture and the stories everyone is talking about.",
  },
] as const;

export type CategorySlug = typeof CATEGORIES[number]["slug"];

export function categoryColor(slug: string): string {
  const c = CATEGORIES.find(c => c.slug === slug);
  return c ? `hsl(var(--${c.color}))` : "hsl(var(--primary))";
}

export function categoryName(slug: string): string {
  return CATEGORIES.find(c => c.slug === slug)?.name ?? slug;
}

export function categoryDescription(slug: string): string {
  return (
    CATEGORIES.find(c => c.slug === slug)?.description ??
    "Independent reporting from the NewsSparkle newsroom."
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
