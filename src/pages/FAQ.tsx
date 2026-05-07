import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: `What is ${SITE.name}?`,
    a: `${SITE.name} is an independent digital news publication covering breaking news, politics & government, business & economy, technology & AI, health & lifestyle, and entertainment & trending. We publish 18 fresh, fact-checked stories every day across six dedicated sections.`,
  },
  {
    q: "How often is the site updated?",
    a: "Our editorial desk publishes new articles 18 times per day in three slots — morning briefings, midday trending explainers, and evening deep-dive analysis — so the homepage is always current.",
  },
  {
    q: "Where do your stories come from?",
    a: "We monitor verified wire services, official press releases, and global trending feeds (NewsAPI and SerpAPI), then independently rewrite, fact-check, and structure every article using our editorial standards before publishing.",
  },
  {
    q: "Is the content written by AI or humans?",
    a: "Our workflow is a hybrid: trending topics are surfaced by automated monitors, articles are drafted with AI assistance using strict editorial prompts, and every story follows the same structural quality bar — H1/H2/H3 hierarchy, key takeaways, FAQs, and source attribution.",
  },
  {
    q: "How can I contact the editorial team?",
    a: `You can reach us via the Contact page. We welcome story tips, corrections, and feedback.`,
  },
  {
    q: "Do you have a sitemap or RSS feed?",
    a: `Yes — our XML sitemap is available at /sitemap.xml and is updated continuously as new stories publish.`,
  },
  {
    q: "How do I follow specific topics?",
    a: "Visit any of our six section pages — Breaking & National, International, Business & Finance, Technology & AI, Sports, or Entertainment & Viral — to see the latest headlines for that topic.",
  },
  {
    q: "Can I republish your articles?",
    a: "Articles are copyrighted. For syndication or republishing rights, please contact our editorial team via the Contact page.",
  },
];

export default function FAQ() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Layout>
      <SEO
        title={`Frequently Asked Questions | ${SITE.name}`}
        description={`Answers to common questions about ${SITE.name} — how we publish, our editorial standards, content sources, and how to get in touch.`}
        path="/faq"
        keywords={["FAQ", "frequently asked questions", SITE.name, "news site", "editorial policy"]}
        jsonLd={faqLd}
      />
      <div className="container-prose py-12 sm:py-16">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>FAQ</span>
        </nav>
        <h1 className="font-serif text-4xl sm:text-5xl font-black tracking-tight text-headline">Frequently Asked Questions</h1>
        <p className="mt-4 text-lg text-foreground/80">Everything you need to know about how {SITE.name} reports, publishes, and serves the news.</p>

        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-serif text-lg font-semibold text-headline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-foreground/85 leading-relaxed text-base">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-12 p-6 bg-secondary border-l-4 border-primary">
          <h2 className="font-serif text-xl font-bold mb-2">Still have a question?</h2>
          <p className="text-foreground/85">We'd love to hear from you. <Link to="/contact" className="text-primary font-semibold underline">Contact our editorial team</Link> and we'll get back to you.</p>
        </div>
      </div>
    </Layout>
  );
}
