import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";
import { CheckCircle, Globe, Zap, Users } from "lucide-react";

export default function About() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE.name,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    description: SITE.description,
    sameAs: [`https://twitter.com/${SITE.twitter.replace(/^@/, "")}`],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Editorial",
      email: SITE.email,
    },
  };

  return (
    <Layout>
      <SEO
        title={`About ${SITE.name} — Who We Are`}
        description={`Learn about ${SITE.name}'s editorial mission, editorial standards, fact-checking process, and the team behind professional news reporting.`}
        path="/about"
        keywords={[
          "about us",
          "editorial standards",
          "fact-checking",
          "journalism",
          SITE.name,
        ]}
        jsonLd={orgLd}
      />

      {/* Hero section */}
      <section className="bg-gradient-to-b from-secondary/30 to-transparent border-b border-border">
        <div className="container-prose py-16 sm:py-24">
          <span className="kicker text-primary">About us</span>
          <h1 className="headline-hero mt-3 mb-6">
            Professional news reporting for the modern reader.
          </h1>
          <p className="text-xl text-foreground/80 leading-relaxed max-w-2xl">
            {SITE.name} is an independent digital news platform dedicated to delivering
            accurate, well-researched journalism on the stories that shape your world.
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="container-prose py-12 sm:py-16">
        {/* Mission statement */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-6">Our Mission</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-lg text-foreground/85 leading-relaxed mb-4">
                In an era of information overload and fragmented attention, our mission is
                straightforward: cut through the noise and deliver clear, accurate reporting on
                what actually matters.
              </p>
              <p className="text-lg text-foreground/85 leading-relaxed">
                We focus on stories with measurable real-world impact — political decisions,
                economic data, technological breakthroughs, health discoveries, and cultural
                moments that shape society.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="card-base p-6">
                <Zap className="size-6 text-primary mb-3" />
                <h3 className="font-serif font-bold text-headline mb-2">Fast and Clear</h3>
                <p className="text-sm text-foreground/80">
                  Reporting with the depth serious readers expect and clarity busy ones need.
                </p>
              </div>
              <div className="card-base p-6">
                <CheckCircle className="size-6 text-primary mb-3" />
                <h3 className="font-serif font-bold text-headline mb-2">Verified Facts</h3>
                <p className="text-sm text-foreground/80">
                  Every claim cross-checked against primary sources and expert analysis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Editorial standards */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-6">Editorial Standards & Process</h2>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Left column */}
            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-4">
                Our Editorial Principles
              </h3>
              <ul className="space-y-4">
                {[
                  {
                    title: "Accuracy First",
                    desc: "Every story is researched against primary sources including government records, court filings, academic papers, and on-the-record interviews.",
                  },
                  {
                    title: "Transparency",
                    desc: "We disclose our sources to standard journalistic practice. Corrections are published immediately and prominently when errors occur.",
                  },
                  {
                    title: "Independence",
                    desc: "Editorial decisions are made independently. Advertising and sponsored placements are clearly labelled and never influence reporting.",
                  },
                  {
                    title: "Context & Nuance",
                    desc: "We avoid false balance and sensationalism. Complex issues are explained with appropriate context and qualified language.",
                  },
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <CheckCircle className="size-5 text-primary shrink-0 mt-1" />
                    <div>
                      <strong className="text-headline">{item.title}</strong>
                      <p className="text-foreground/80 text-sm mt-1">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="card-base p-6 border-l-4 border-primary">
                <h4 className="font-serif font-bold text-headline mb-3">
                  Fact-Checking Process
                </h4>
                <ol className="space-y-2 text-sm text-foreground/85">
                  <li>
                    <strong>Research:</strong> Stories sourced from primary documents,
                    official statements, and credentialed experts
                  </li>
                  <li>
                    <strong>Verification:</strong> Claims checked against multiple independent
                    sources
                  </li>
                  <li>
                    <strong>Review:</strong> Edited for accuracy, tone, and clarity before
                    publication
                  </li>
                  <li>
                    <strong>Publication:</strong> Stories published with full source attribution
                  </li>
                </ol>
              </div>

              <div className="card-base p-6">
                <h4 className="font-serif font-bold text-headline mb-3">Corrections Policy</h4>
                <p className="text-sm text-foreground/85">
                  When factual errors occur, we publish corrections immediately and link from the
                  original article. All corrections are archived transparently on our{" "}
                  <Link to="/corrections" className="text-primary underline hover:no-underline">
                    corrections page
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust signals */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Why Trust NewsSparkle</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Professional Editorial Team",
                desc: "Experienced journalists and specialist reporters with proven credentials in breaking news, analysis, and investigation.",
              },
              {
                icon: CheckCircle,
                title: "Rigorous Fact-Checking",
                desc: "Every article cross-referenced with primary sources, expert interviews, and official documentation.",
              },
              {
                icon: Globe,
                title: "Independent Coverage",
                desc: "Editorially independent reporting with no advertiser influence on our journalism.",
              },
              {
                icon: Zap,
                title: "Real-Time Accuracy",
                desc: "Stories updated with new information as it develops, with timestamp showing when articles were last updated.",
              },
              {
                icon: CheckCircle,
                title: "Transparent Corrections",
                desc: "Honest about errors. Corrections are published immediately and visible to all readers.",
              },
              {
                icon: Users,
                title: "Accessible Leadership",
                desc: "Meet our team on the Authors page. Read about their expertise and beats.",
              },
            ].map((item, i) => (
              <div key={i} className="card-base p-6">
                <item.icon className="size-6 text-primary mb-3" />
                <h3 className="font-serif font-bold text-headline mb-2">{item.title}</h3>
                <p className="text-sm text-foreground/80">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Publishing standards */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-6">Publishing Standards</h2>
          <div className="prose-article">
            <h3>What We Cover</h3>
            <p>
              {SITE.name} covers six subject areas, each overseen by specialist desks with deep
              expertise:
            </p>
            <ul>
              <li>
                <strong>Breaking News</strong> — Major announcements, natural disasters, and
                developing situations
              </li>
              <li>
                <strong>Politics & Government</strong> — Legislative action, elections, and
                policy developments
              </li>
              <li>
                <strong>Business & Economy</strong> — Markets, corporate developments, and
                economic data
              </li>
              <li>
                <strong>Technology & AI</strong> — Tech launches, AI research, and digital
                trends
              </li>
              <li>
                <strong>Health & Lifestyle</strong> — Medical research, public health, and
                wellness
              </li>
              <li>
                <strong>Entertainment & Trending</strong> — Cultural moments and internet trends
              </li>
            </ul>

            <h3>Publishing Frequency</h3>
            <p>
              Our editorial desk publishes new reporting throughout the day. We prioritise depth
              and accuracy over publishing volume, so expect fewer but higher-quality stories than
              high-volume news feeds.
            </p>

            <h3>Story Types</h3>
            <p>We publish:</p>
            <ul>
              <li>Breaking news coverage with real-time updates</li>
              <li>In-depth analysis and explainers</li>
              <li>Investigative journalism</li>
              <li>Data journalism and visualisations</li>
              <li>Expert interviews and commentary</li>
            </ul>
          </div>
        </section>

        {/* Contact section */}
        <section>
          <h2 className="headline-lg mb-6">Get in Touch</h2>
          <div className="card-base p-8 bg-primary/5 border-primary/20">
            <p className="text-lg text-foreground/80 mb-6">
              Have a news tip? Found an error? Want to pitch a story? Reach out to our editorial
              desk.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/contact"
                className="btn-primary px-6 py-3 flex items-center justify-center"
              >
                Contact Us
              </Link>
              <a
                href={`mailto:${SITE.email}`}
                className="btn btn-secondary px-6 py-3 flex items-center justify-center"
              >
                {SITE.email}
              </a>
            </div>

            <p className="text-sm text-foreground/70 mt-6">
              For security or privacy concerns, see our{" "}
              <Link to="/privacy" className="text-primary underline hover:no-underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/disclaimer" className="text-primary underline hover:no-underline">
                Disclaimer
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
