import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";

export default function Disclaimer() {
  return (
    <Layout>
      <SEO title="Disclaimer" description={`Editorial and content disclaimer for ${SITE.name}.`} path="/disclaimer" />
      <div className="container-prose py-14">
        <span className="kicker text-primary">Legal</span>
        <h1 className="headline-hero mt-2">Disclaimer</h1>
        <div className="prose-article mt-8">
          <p>The information published on {SITE.name} is for general informational and educational purposes only. While we work to ensure accuracy, we make no representations or warranties of any kind, express or implied, about the completeness, reliability or availability of the content.</p>
          <h2>Not Professional Advice</h2>
          <p>Articles relating to financial, legal, medical, technological or political matters are not a substitute for professional advice. Always consult a qualified specialist before making decisions based on the information provided here.</p>
          <h2>External Links</h2>
          <p>Our articles may include links to third-party websites for reference. We do not endorse or assume responsibility for the content of those external resources.</p>
          <h2>AI-Assisted Content</h2>
          <p>Some content on this website is produced with the assistance of artificial-intelligence tools and reviewed against authoritative public sources. We commit to transparency about our process and welcome corrections at <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
          <h2>Affiliate & Advertising</h2>
          <p>{SITE.name} may earn revenue through display advertising and affiliate links. These never influence our editorial judgement.</p>
        </div>
      </div>
    </Layout>
  );
}
