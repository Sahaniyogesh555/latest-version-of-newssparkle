import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";
import { FileText, Shield, Users, AlertTriangle } from "lucide-react";

export default function Terms() {
  const termsLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    description: `The terms of service governing your use of ${SITE.name}.`,
    url: `${SITE.url}/terms`,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
  };

  return (
    <Layout>
      <SEO
        title="Terms of Service"
        description={`The terms of service governing your use of ${SITE.name}. Please read these terms carefully before using our website.`}
        path="/terms"
        jsonLd={termsLd}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-secondary/30 to-transparent border-b border-border">
        <div className="container-prose py-16 sm:py-24">
          <span className="kicker text-primary">Legal</span>
          <h1 className="headline-hero mt-3 mb-6">Terms of Service</h1>
          <p className="text-xl text-foreground/80 leading-relaxed max-w-2xl">
            These terms govern your use of {SITE.name}. By accessing our website, you agree to these terms.
            Please read them carefully.
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="container-prose py-12 sm:py-16">
        {/* Last updated */}
        <div className="mb-8 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-sm text-byline">
            <strong>Last updated:</strong> May 8, 2026
          </p>
        </div>

        {/* Overview */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Agreement Overview</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card-base p-6">
              <FileText className="size-6 text-primary mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Clear Terms</h3>
              <p className="text-sm text-foreground/80">
                These terms are written in plain language to ensure transparency and understanding.
              </p>
            </div>
            <div className="card-base p-6">
              <Shield className="size-6 text-primary mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Your Rights</h3>
              <p className="text-sm text-foreground/80">
                We respect your rights and privacy. These terms protect both users and our editorial integrity.
              </p>
            </div>
          </div>
        </section>

        {/* Terms sections */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Terms of Use</h2>
          <div className="prose-article space-y-8">
            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">1. Acceptance of Terms</h3>
              <p>
                By accessing and using {SITE.name}, you accept and agree to be bound by the terms and provision
                of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">2. Use License</h3>
              <p>
                Permission is granted to temporarily access the materials (information or software) on {SITE.name}
                for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer
                of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>modify or copy the materials;</li>
                <li>use the materials for any commercial purpose or for any public display;</li>
                <li>attempt to decompile or reverse engineer any software contained on the website;</li>
                <li>remove any copyright or other proprietary notations from the materials.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">3. User Content</h3>
              <p>
                If you submit comments, tips, or other content to {SITE.name}, you grant us a non-exclusive,
                royalty-free, perpetual, and worldwide license to use, display, and distribute your content
                in connection with our services. You represent that you own or have the right to use any
                content you submit.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">4. Intellectual Property</h3>
              <p>
                All articles, images, and other content on {SITE.name} are © {SITE.name} unless otherwise credited.
                You may share excerpts with proper attribution and a link back to the original article.
                Republishing in full requires written permission from our editorial team.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">5. Accuracy of Materials</h3>
              <p>
                The materials appearing on {SITE.name} could include technical, typographical, or photographic errors.
                {SITE.name} does not warrant that any of the materials on its website are accurate, complete, or current.
                {SITE.name} may make changes to the materials contained on its website at any time without notice.
              </p>
            </div>
          </div>
        </section>

        {/* Disclaimers */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Disclaimers & Limitations</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card-base p-6 border-l-4 border-amber-500">
              <AlertTriangle className="size-6 text-amber-600 mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">No Warranties</h3>
              <p className="text-sm text-foreground/80">
                Content is provided "as is" for informational purposes. We strive for accuracy but make no warranty
                that content is complete, current, or error-free.
              </p>
            </div>
            <div className="card-base p-6 border-l-4 border-red-500">
              <Shield className="size-6 text-red-600 mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Limitation of Liability</h3>
              <p className="text-sm text-foreground/80">
                To the maximum extent permitted by law, {SITE.name} shall not be liable for any indirect,
                incidental, or consequential damages arising from your use of the site.
              </p>
            </div>
          </div>
        </section>

        {/* Additional terms */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Additional Provisions</h2>
          <div className="prose-article space-y-6">
            <div>
              <h3 className="font-serif text-lg font-bold text-headline mb-2">Third-Party Links</h3>
              <p>
                Articles may link to external sites. We are not responsible for the content, privacy policies,
                or practices of third-party websites or services.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-headline mb-2">Governing Law</h3>
              <p>
                These terms and conditions are governed by and construed in accordance with the laws of
                the jurisdiction in which {SITE.name} operates, and you irrevocably submit to the exclusive
                jurisdiction of the courts in that state or location.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-headline mb-2">Changes to Terms</h3>
              <p>
                We may amend these terms at any time. Continued use of the site after changes constitutes
                acceptance of the revised terms. We will notify users of significant changes via our website.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="card-base p-8 bg-primary/5 border-primary/20">
          <h3 className="font-serif font-bold text-headline mb-3">Questions about these terms?</h3>
          <p className="text-foreground/85 mb-4">
            If you have any questions about these Terms of Service, please contact our editorial team.
          </p>
          <Link to="/contact" className="text-primary underline hover:no-underline">
            Contact us →
          </Link>
        </section>
      </div>
    </Layout>
  );
}
