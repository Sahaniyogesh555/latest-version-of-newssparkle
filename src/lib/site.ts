export const SITE = {
  name: "NewsSparkle",
  tagline: "Your daily briefing on what actually matters.",
  description: "Your daily briefing on what matters — breaking news, politics, tech, business, health and entertainment. Handpicked, fact-checked, and refreshingly readable.",
  url: typeof window !== "undefined" ? window.location.origin : "https://newssparkle.lovable.app",
  twitter: "@newssparkle",
  publisher: "NewsSparkle Editorial Desk",
  logo: "/logo.svg",
  // TODO: replace with your contact Gmail before AdSense submission
  email: "contact.newssparkle@gmail.com",
  // TODO: replace with your real ID after AdSense approval (also update public/ads.txt + index.html script)
  adsensePublisherId: "ca-pub-XXXXXXXXXXXXXXXX",
};

export const CATEGORIES = [
  { slug: "breaking-news", name: "Breaking News", color: "cat-breaking" },
  { slug: "politics", name: "Politics & Government", color: "cat-politics" },
  { slug: "business", name: "Business & Economy", color: "cat-business" },
  { slug: "technology", name: "Technology & AI", color: "cat-technology" },
  { slug: "health", name: "Health & Lifestyle", color: "cat-health" },
  { slug: "entertainment", name: "Entertainment & Trending", color: "cat-entertainment" },
] as const;

export type CategorySlug = typeof CATEGORIES[number]["slug"];

export function categoryColor(slug: string): string {
  const c = CATEGORIES.find(c => c.slug === slug);
  return c ? `hsl(var(--${c.color}))` : "hsl(var(--primary))";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
