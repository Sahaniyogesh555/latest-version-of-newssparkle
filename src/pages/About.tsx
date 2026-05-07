import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";

export default function About() {
  return (
    <Layout>
      <SEO title={`About ${SITE.name}`} description={`Learn about ${SITE.name}, our editorial mission, standards and the team behind the reporting.`} path="/about" />
      <div className="container-prose py-14">
        <span className="kicker text-primary">About</span>
        <h1 className="headline-hero mt-2">About {SITE.name}</h1>
        <div className="prose-article mt-8">
          <p>{SITE.name} is your daily briefing on what actually matters. We handpick and fact-check the stories shaping the world today across breaking news, politics & government, business & economy, technology & AI, health & lifestyle, and entertainment & trending — the six pillars of modern current affairs.</p>
          <h2>Our Mission</h2>
          <p>In an era of information overload, our mission is simple: cut through the noise. We report what is happening, why it matters and what comes next — with the depth a serious reader expects and the clarity a busy one needs.</p>
          <h2>Editorial Standards</h2>
          <p>Every story published on {SITE.name} is researched against multiple primary sources, fact-checked for accuracy and written to a strict neutral, journalistic tone. We disclose corrections transparently and credit our sources visibly.</p>
          <h2>Publishing Cadence</h2>
          <p>Our editorial desk publishes new reporting throughout the day. We prioritise stories with measurable real-world impact — economic, political, technological or social — over noise and outrage.</p>
          <h2>Independence</h2>
          <p>{SITE.name} is editorially independent. Advertising and sponsored placements, where present, are clearly labelled and never influence our reporting decisions.</p>
        </div>
      </div>
    </Layout>
  );
}
