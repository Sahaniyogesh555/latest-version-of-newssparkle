import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";

export default function Corrections() {
  return (
    <Layout>
      <SEO
        title="Corrections Policy"
        description={`How ${SITE.name} handles errors, updates and corrections. Read our public corrections policy and learn how to request a correction.`}
        path="/corrections"
        keywords={["corrections policy", "errata", "journalism ethics", SITE.name]}
      />
      <div className="container-prose py-14">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Corrections</span>
        </nav>
        <span className="kicker text-primary">Trust & Transparency</span>
        <h1 className="headline-hero mt-2">Corrections Policy</h1>
        <p className="mt-4 text-lg text-foreground/80">
          We take accuracy seriously. When we make a mistake, we say so clearly and fix it
          quickly.
        </p>

        <div className="prose-article mt-10">
          <h2>Our Commitment</h2>
          <p>
            {SITE.name} is committed to publishing accurate, fact-checked reporting. Despite our
            multi-stage editorial workflow, errors occasionally occur. When they do, we treat them
            as a priority — not a footnote.
          </p>

          <h2>Types of Updates</h2>
          <ul>
            <li>
              <strong>Correction</strong> — issued when we have reported a factual error (a wrong
              name, date, number, attribution or claim). The article is updated and a clearly
              labelled <em>Correction</em> note is appended.
            </li>
            <li>
              <strong>Clarification</strong> — issued when phrasing was technically accurate but
              ambiguous or could be reasonably misread. A <em>Clarification</em> note explains the
              change.
            </li>
            <li>
              <strong>Update</strong> — issued when new verified information materially advances a
              developing story. Updates are timestamped and stacked at the top or bottom of the
              live article.
            </li>
            <li>
              <strong>Retraction</strong> — issued only when a story's central premise is
              demonstrably wrong and cannot be salvaged by correction. The article is taken down
              and replaced with a public retraction note explaining what was wrong, why, and what
              we know now.
            </li>
          </ul>

          <h2>Turnaround</h2>
          <p>
            Verified corrections are processed and published within <strong>24 hours</strong> of
            confirmation. Live developing-news updates are published as soon as the new fact is
            verified.
          </p>

          <h2>How to Request a Correction</h2>
          <p>
            If you believe an article contains an error, please send the following to{" "}
            <a href={`mailto:${SITE.email}`} className="text-primary underline">{SITE.email}</a>{" "}
            (or via our <Link to="/contact" className="text-primary underline">Contact page</Link>):
          </p>
          <ul>
            <li>The article URL.</li>
            <li>The exact sentence or claim you believe is incorrect.</li>
            <li>The correct information, with a source we can verify.</li>
            <li>Your name and (optional) affiliation.</li>
          </ul>
          <p>
            We will respond within two business days to acknowledge receipt and follow up with the
            outcome of our verification.
          </p>

          <h2>Transparency</h2>
          <p>
            We do not silently edit published articles. Every correction, clarification and
            retraction is disclosed inside the article it concerns. We never delete published
            corrections from the public record.
          </p>

          <p className="text-sm text-byline mt-10">
            Last reviewed: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </Layout>
  );
}
