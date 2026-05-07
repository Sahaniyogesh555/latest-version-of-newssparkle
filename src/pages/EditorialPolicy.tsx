import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";

export default function EditorialPolicy() {
  return (
    <Layout>
      <SEO
        title="Editorial Policy & Standards"
        description={`How ${SITE.name} researches, writes, fact-checks and publishes the news — our editorial policy, sourcing standards and AI-assistance disclosure.`}
        path="/editorial-policy"
        keywords={["editorial policy", "editorial standards", "fact-checking", "journalism ethics", SITE.name]}
      />
      <div className="container-prose py-14">
        <nav className="text-xs text-byline uppercase tracking-wider mb-4">
          <Link to="/" className="hover:text-primary">Home</Link> · <span>Editorial Policy</span>
        </nav>
        <span className="kicker text-primary">Trust & Transparency</span>
        <h1 className="headline-hero mt-2">Editorial Policy</h1>
        <p className="mt-4 text-lg text-foreground/80">
          The standards that govern every story we publish at {SITE.name}.
        </p>

        <div className="prose-article mt-10">
          <h2>Mission &amp; Independence</h2>
          <p>
            {SITE.name} is an editorially independent digital news publication. No advertiser,
            sponsor, partner or external party has any influence over what we cover, how we cover
            it, or when stories run. Editorial decisions are made solely by our newsroom against
            this published policy.
          </p>

          <h2>Sourcing Standards</h2>
          <p>
            Every story is built from <strong>multiple independent sources</strong>. Our preferred
            sources, in priority order, are:
          </p>
          <ol>
            <li>Primary documents — official statements, government records, court filings, company filings, peer-reviewed research.</li>
            <li>Established wire services — Reuters, Associated Press, AFP and equivalent regional wires.</li>
            <li>Specialist outlets with documented editorial standards (technology, finance, health journals).</li>
            <li>On-the-record interviews and confirmed expert commentary.</li>
          </ol>
          <p>
            We never republish or paraphrase a single-source story without independent verification.
            When a fact is reported by only one outlet and we cannot confirm it elsewhere, we either
            flag it as <em>unconfirmed</em> in the article body or hold the story.
          </p>

          <h2>Fact-Checking Workflow</h2>
          <p>
            Before publication, every article passes a four-stage check:
          </p>
          <ul>
            <li><strong>Claim extraction</strong> — every factual claim, number and quotation is itemised.</li>
            <li><strong>Cross-source verification</strong> — each claim is matched against at least two independent sources.</li>
            <li><strong>Context review</strong> — an editor checks for missing context, loaded framing or ambiguous phrasing.</li>
            <li><strong>Final read</strong> — a sub-editor performs a copy and structural pass before publication.</li>
          </ul>

          <h2>AI-Assistance Disclosure</h2>
          <p>
            {SITE.name} uses artificial-intelligence tools to monitor breaking-news feeds, draft
            initial article structures and assist with summarisation. <strong>Every article</strong>
            is written under newsroom prompts that enforce neutral journalistic tone, original
            phrasing, and source attribution, and is reviewed against authoritative public sources
            before publication. We do not publish unedited model output. This hybrid workflow lets
            us deliver depth and timeliness while maintaining human editorial judgement.
          </p>

          <h2>Originality &amp; Plagiarism</h2>
          <p>
            All articles are written in our own words. We do not copy sentences verbatim from any
            other source. Where we quote a source directly, the quotation is marked with quotation
            marks and attributed inline. Aggregation, scraping and content spinning are explicitly
            prohibited.
          </p>

          <h2>Neutrality &amp; Tone</h2>
          <p>
            We report what is happening, not what we wish were happening. Our house style is
            neutral, factual and non-sensational. We avoid loaded adjectives, partisan framing and
            outrage cycles. Opinion content, when published, is clearly labelled as such.
          </p>

          <h2>Anonymous Sources</h2>
          <p>
            We use anonymous sourcing only when (a) the information is genuinely in the public
            interest, (b) it cannot be obtained on the record, and (c) the source's reliability has
            been established. We disclose to readers as much as we can about a source's position
            and motive without compromising their identity.
          </p>

          <h2>Conflicts of Interest</h2>
          <p>
            Newsroom contributors disclose any financial, personal or professional interest that
            could influence their reporting. Where a conflict exists, the contributor recuses
            themselves or the conflict is disclosed prominently in the article.
          </p>

          <h2>Corrections</h2>
          <p>
            We correct errors transparently and quickly. See our full{" "}
            <Link to="/corrections" className="text-primary underline">Corrections Policy</Link> for the process and how to submit a correction request.
          </p>

          <h2>Reader Tips &amp; Engagement</h2>
          <p>
            We welcome news tips, document leaks, and corrections from readers. Submit via the{" "}
            <Link to="/contact" className="text-primary underline">Contact page</Link> or email{" "}
            <a href={`mailto:${SITE.email}`} className="text-primary underline">{SITE.email}</a>.
            We protect tipster identities to the fullest extent permitted by law.
          </p>

          <h2>Review Cycle</h2>
          <p>
            This policy is reviewed at least once per year and whenever a material change to our
            workflow occurs. The version date is shown below.
          </p>
          <p className="text-sm text-byline">
            Last reviewed: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </Layout>
  );
}
