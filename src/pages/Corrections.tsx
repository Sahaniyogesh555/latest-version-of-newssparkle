import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";
import { CheckCircle, RefreshCw, AlertTriangle, Clock } from "lucide-react";

export default function Corrections() {
  const correctionsLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Corrections Policy",
    description: `How ${SITE.name} handles errors, updates and corrections. Read our public corrections policy and learn how to request a correction.`,
    url: `${SITE.url}/corrections`,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
  };

  return (
    <Layout>
      <SEO
        title="Corrections Policy"
        description={`How ${SITE.name} handles errors, updates and corrections. Read our public corrections policy and learn how to request a correction.`}
        path="/corrections"
        keywords={["corrections policy", "errata", "journalism ethics", SITE.name]}
        jsonLd={correctionsLd}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-secondary/30 to-transparent border-b border-border">
        <div className="container-prose py-16 sm:py-24">
          <span className="kicker text-primary">Trust & Transparency</span>
          <h1 className="headline-hero mt-3 mb-6">Corrections Policy</h1>
          <p className="text-xl text-foreground/80 leading-relaxed max-w-2xl">
            We take accuracy seriously. When we make a mistake, we say so clearly and fix it quickly.
            Our corrections are transparent, timely, and permanent.
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="container-prose py-12 sm:py-16">
        {/* Trust signals */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Our Correction Standards</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card-base p-6 text-center">
              <CheckCircle className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Transparent</h3>
              <p className="text-sm text-foreground/80">
                All corrections are clearly marked and explained in the article.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <Clock className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Timely</h3>
              <p className="text-sm text-foreground/80">
                Corrections are published within 24 hours of verification.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <RefreshCw className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Permanent</h3>
              <p className="text-sm text-foreground/80">
                We never delete corrections from the public record.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <AlertTriangle className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Accountable</h3>
              <p className="text-sm text-foreground/80">
                We take responsibility for our mistakes and learn from them.
              </p>
            </div>
          </div>
        </section>

        {/* Corrections policy */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Our Commitment</h2>
          <div className="prose-article space-y-8">
            <p>
              {SITE.name} is committed to publishing accurate, fact-checked reporting. Despite our
              multi-stage editorial workflow, errors occasionally occur. When they do, we treat them
              as a priority — not a footnote.
            </p>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">Types of Updates</h3>
              <div className="space-y-4">
                <div className="card-base p-4 border-l-4 border-red-500">
                  <h4 className="font-serif font-semibold text-headline mb-2">Correction</h4>
                  <p className="text-sm text-foreground/80">
                    Issued when we have reported a factual error (a wrong name, date, number, attribution or claim).
                    The article is updated and a clearly labelled <em>Correction</em> note is appended.
                  </p>
                </div>
                <div className="card-base p-4 border-l-4 border-amber-500">
                  <h4 className="font-serif font-semibold text-headline mb-2">Clarification</h4>
                  <p className="text-sm text-foreground/80">
                    Issued when phrasing was technically accurate but ambiguous or could be reasonably misread.
                    A <em>Clarification</em> note explains the change.
                  </p>
                </div>
                <div className="card-base p-4 border-l-4 border-blue-500">
                  <h4 className="font-serif font-semibold text-headline mb-2">Update</h4>
                  <p className="text-sm text-foreground/80">
                    Issued when new verified information materially advances a developing story.
                    Updates are timestamped and stacked at the top or bottom of the live article.
                  </p>
                </div>
                <div className="card-base p-4 border-l-4 border-gray-500">
                  <h4 className="font-serif font-semibold text-headline mb-2">Retraction</h4>
                  <p className="text-sm text-foreground/80">
                    Issued only when a story's central premise is demonstrably wrong and cannot be salvaged by correction.
                    The article is taken down and replaced with a public retraction note explaining what was wrong, why, and what we know now.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">Turnaround Time</h3>
              <p>
                Verified corrections are processed and published within <strong>24 hours</strong> of
                confirmation. Live developing-news updates are published as soon as the new fact is
                verified.
              </p>
            </div>
          </div>
        </section>

        {/* How to request */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">How to Request a Correction</h2>
          <div className="card-base p-8">
            <p className="text-foreground/85 mb-6">
              If you believe an article contains an error, please send the following to{" "}
              <a href={`mailto:${SITE.email}`} className="text-primary underline hover:no-underline">{SITE.email}</a>{" "}
              (or via our <Link to="/contact" className="text-primary underline hover:no-underline">Contact page</Link>):
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground/85">
              <li>The article URL.</li>
              <li>The exact sentence or claim you believe is incorrect.</li>
              <li>The correct information, with a source we can verify.</li>
              <li>Your name and (optional) affiliation.</li>
            </ul>
            <p className="mt-6 text-foreground/85">
              We will respond within two business days to acknowledge receipt and follow up with the
              outcome of our verification.
            </p>
          </div>
        </section>

        {/* Transparency */}
        <section className="mb-16">
          <h2 className="headline-lg mb-8">Transparency & Accountability</h2>
          <div className="prose-article">
            <p>
              We do not silently edit published articles. Every correction, clarification and
              retraction is disclosed inside the article it concerns. We never delete published
              corrections from the public record.
            </p>
            <p className="mt-4">
              Our corrections archive is publicly available, demonstrating our commitment to
              journalistic integrity and continuous improvement.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="card-base p-8 bg-primary/5 border-primary/20">
          <h3 className="font-serif font-bold text-headline mb-3">Found an error?</h3>
          <p className="text-foreground/85 mb-4">
            Help us maintain accuracy. Submit corrections through our contact form or email.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/contact" className="btn-primary px-6 py-3 text-center">
              Submit a Correction
            </Link>
            <a href={`mailto:${SITE.email}`} className="btn-primary px-6 py-3 text-center">
              Email Directly
            </a>
          </div>
          <p className="text-xs text-byline mt-4">
            Last reviewed: May 2026
          </p>
        </section>
      </div>
    </Layout>
  );
}
