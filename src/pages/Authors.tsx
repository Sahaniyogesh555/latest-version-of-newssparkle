import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";

const AUTHORS = [
  {
    name: "NewsSparkle Editorial Desk",
    role: "Lead Newsroom",
    beat: "Breaking news, daily briefings, story coordination",
    bio:
      "The central editorial desk that coordinates daily coverage, sets the news agenda, and signs off on every story before publication. The desk operates under our published Editorial Policy and reports to the Editor-in-Chief.",
  },
  {
    name: "Politics & Policy Desk",
    role: "Senior Reporters",
    beat: "Government, elections, public policy, international affairs",
    bio:
      "Covers legislative developments, electoral politics, executive actions and global diplomacy. Sources draw from official records, court filings and on-the-record interviews with policy makers.",
  },
  {
    name: "Business & Markets Desk",
    role: "Senior Analysts",
    beat: "Economy, markets, corporate news, jobs",
    bio:
      "Tracks listed-company filings, central-bank communications and macro indicators. Specialises in turning raw market data into clear, contextual reporting for non-specialist readers.",
  },
  {
    name: "Technology & AI Desk",
    role: "Specialist Reporters",
    beat: "Software, AI research, product launches, cyber-security",
    bio:
      "Reports on the products, papers and platform shifts shaping the technology industry. Cross-references vendor announcements with independent benchmarks and primary research.",
  },
  {
    name: "Health & Lifestyle Desk",
    role: "Health Reporters",
    beat: "Medicine, public health, fitness, nutrition, wellbeing",
    bio:
      "Sources stories from peer-reviewed journals, public-health authorities and credentialed clinicians. Avoids unsubstantiated medical claims; flags ongoing research as preliminary where appropriate.",
  },
  {
    name: "Entertainment & Culture Desk",
    role: "Culture Writers",
    beat: "Film, television, music, viral trends, celebrity",
    bio:
      "Covers the cultural moments that shape conversation. Distinguishes confirmed news from rumour and labels opinion content explicitly.",
  },
];

export default function Authors() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE.name,
    url: SITE.url,
    employee: AUTHORS.map(a => ({
      "@type": "Person",
      name: a.name,
      jobTitle: a.role,
      knowsAbout: a.beat,
      worksFor: { "@type": "Organization", name: SITE.name },
    })),
  };

  return (
    <Layout>
      <SEO
        title="Our Authors & Editorial Team"
        description={`Meet the desks and reporters behind ${SITE.name}. Our editorial team's beats, expertise and bylines.`}
        path="/authors"
        keywords={["authors", "editorial team", "reporters", "newsroom", SITE.name]}
        jsonLd={orgLd}
      />
      <div className="container-prose py-14">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Authors</span>
        </nav>
        <span className="kicker text-primary">Newsroom</span>
        <h1 className="headline-hero mt-2">Our Authors</h1>
        <p className="mt-4 text-lg text-foreground/80">
          The desks and reporters behind {SITE.name}. Every article is signed by the desk that
          produced it and reviewed by an editor before publication. Read our{" "}
          <Link to="/editorial-policy" className="text-primary underline">Editorial Policy</Link>{" "}
          for how we work.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {AUTHORS.map(a => (
            <article key={a.name} className="border border-border p-6 bg-background">
              <div className="kicker text-byline">{a.role}</div>
              <h2 className="font-serif text-xl font-bold text-headline mt-1">{a.name}</h2>
              <p className="text-sm text-primary mt-1 font-semibold">{a.beat}</p>
              <p className="mt-3 text-sm text-foreground/85 leading-relaxed">{a.bio}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 p-6 bg-secondary border-l-4 border-primary">
          <h2 className="font-serif text-xl font-bold mb-2">Pitch us a story</h2>
          <p className="text-foreground/85">
            Have a tip, a document, or expertise on an under-covered story? Reach the desk via the{" "}
            <Link to="/contact" className="text-primary font-semibold underline">Contact page</Link>{" "}
            or email{" "}
            <a href={`mailto:${SITE.email}`} className="text-primary font-semibold underline">{SITE.email}</a>.
          </p>
        </div>
      </div>
    </Layout>
  );
}
