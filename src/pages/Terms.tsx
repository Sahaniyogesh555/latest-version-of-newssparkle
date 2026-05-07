import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";

export default function Terms() {
  return (
    <Layout>
      <SEO title="Terms of Service" description={`The terms of service governing your use of ${SITE.name}.`} path="/terms" />
      <div className="container-prose py-14">
        <span className="kicker text-primary">Legal</span>
        <h1 className="headline-hero mt-2">Terms of Service</h1>
        <div className="prose-article mt-8">
          <p>By accessing {SITE.name}, you agree to these terms. Please read them carefully.</p>
          <h2>Use of Content</h2>
          <p>All articles, images and other content are © {SITE.name} unless otherwise credited. You may share excerpts with attribution and a link back to the original article. Republishing in full requires written permission.</p>
          <h2>No Warranties</h2>
          <p>Content is provided "as is" for informational purposes. We strive for accuracy but make no warranty that content is complete, current or error-free.</p>
          <h2>Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, {SITE.name} shall not be liable for any indirect, incidental or consequential damages arising from your use of the site.</p>
          <h2>Third-Party Links</h2>
          <p>Articles may link to external sites. We are not responsible for the content or practices of third parties.</p>
          <h2>Changes</h2>
          <p>We may amend these terms at any time. Continued use of the site constitutes acceptance of the revised terms.</p>
        </div>
      </div>
    </Layout>
  );
}
