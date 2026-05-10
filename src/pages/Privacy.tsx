import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { Link } from "react-router-dom";
import { Shield, Eye, Lock, Users } from "lucide-react";

export default function Privacy() {
  const lastUpdated = "May 8, 2026";

  const privacyLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy",
    description: `Read the ${SITE.name} privacy policy: what data we collect, how cookies and analytics work, advertising disclosures, your rights and how to contact us.`,
    url: `${SITE.url}/privacy`,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    },
  };

  return (
    <Layout>
      <SEO
        title="Privacy Policy"
        description={`Read the ${SITE.name} privacy policy: what data we collect, how cookies and analytics work, advertising disclosures, your rights and how to contact us.`}
        path="/privacy"
        jsonLd={privacyLd}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-secondary/30 to-transparent border-b border-border">
        <div className="container-prose py-16 sm:py-24">
          <span className="kicker text-primary">Legal</span>
          <h1 className="headline-hero mt-3 mb-6">Privacy Policy</h1>
          <p className="text-xl text-foreground/80 leading-relaxed max-w-2xl">
            Your privacy matters to us. This policy explains how we collect, use, and protect your information
            when you visit {SITE.name}.
          </p>
          <p className="text-sm text-byline mt-4">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="container-prose py-12 sm:py-16">
        {/* Trust signals */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Our Privacy Commitments</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card-base p-6 text-center">
              <Shield className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">No Data Sales</h3>
              <p className="text-sm text-foreground/80">
                We never sell your personal information to third parties.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <Eye className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Transparency</h3>
              <p className="text-sm text-foreground/80">
                We clearly explain what data we collect and how we use it.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <Lock className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Secure Handling</h3>
              <p className="text-sm text-foreground/80">
                Your data is protected with industry-standard security measures.
              </p>
            </div>
            <div className="card-base p-6 text-center">
              <Users className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-headline mb-2">Your Rights</h3>
              <p className="text-sm text-foreground/80">
                You have control over your data and can exercise your privacy rights.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy policy content */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Privacy Policy Details</h2>
          <div className="prose-article space-y-8">
            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">1. Who We Are</h3>
              <p>
                {SITE.name} is an independent digital news publication operated by the {SITE.publisher}. For any privacy
                related question you can reach us at{" "}
                <a href={`mailto:${SITE.email}`} className="text-primary hover:underline">{SITE.email}</a>.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">2. Information We Collect</h3>
              <h4 className="font-serif text-lg font-semibold text-headline mb-2">2.1 Information you provide</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Contact form data</strong> — name, email address and the content of your message when you contact us.</li>
                <li><strong>Newsletter / subscription data</strong> — email address if you sign up for updates.</li>
                <li><strong>Correspondence</strong> — any information you send us by email.</li>
              </ul>

              <h4 className="font-serif text-lg font-semibold text-headline mb-2 mt-4">2.2 Information collected automatically</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Log data</strong> — IP address, browser type and version, operating system, referring URL, pages visited, date and time of access.</li>
                <li><strong>Device data</strong> — device type, screen size, language and approximate location derived from IP.</li>
                <li><strong>Usage data</strong> — clicks, scroll depth, session duration and similar interaction signals.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">3. Cookies & Similar Technologies</h3>
              <p>
                We use cookies, local storage and similar technologies to operate the Site, remember your preferences,
                measure traffic and (where applicable) serve advertising. Cookies we use include:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li><strong>Strictly necessary cookies</strong> — required for core functionality such as remembering your cookie consent choice and preferred language.</li>
                <li><strong>Analytics cookies</strong> — help us understand which articles are read, so we can improve our coverage. These may be set by Google Analytics or a similar provider.</li>
                <li><strong>Advertising cookies</strong> — set by Google AdSense and its partners to show relevant ads and measure ad performance.</li>
                <li><strong>Preference cookies</strong> — remember settings such as your selected language for the on-site translator.</li>
              </ul>
              <p className="mt-3">
                You can control cookies through your browser settings and, where shown, through our on-site cookie
                consent banner. Disabling some cookies may affect Site functionality.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">4. Analytics</h3>
              <p>
                We may use Google Analytics and other privacy-respecting analytics tools to understand aggregate
                readership. These tools collect information such as pages viewed, time on page and approximate
                location, and process it on our behalf. You can opt out of Google Analytics by installing the{" "}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google Analytics Opt-out Browser Add-on
                </a>.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">5. Advertising & Google AdSense</h3>
              <p>
                We may display advertising served by Google AdSense and other third-party ad networks. These vendors,
                including Google, use cookies to serve ads based on your prior visits to this and other websites.
                Google's use of advertising cookies enables it and its partners to serve ads to our users based on
                their visits to our sites and/or other sites on the Internet.
              </p>
              <p className="mt-3">
                You can opt out of personalised advertising by visiting{" "}
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Ads Settings</a>{" "}
                or, for many other networks,{" "}
                <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aboutads.info</a>{" "}
                and{" "}
                <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">youronlinechoices.eu</a>.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">6. How We Use Information</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>To operate, maintain and improve the Site and our content.</li>
                <li>To respond to enquiries, feedback and correction requests.</li>
                <li>To measure readership and understand which topics matter most to you.</li>
                <li>To prevent fraud, abuse and security incidents.</li>
                <li>To comply with legal obligations.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">7. Legal Bases (EEA / UK Readers)</h3>
              <p>
                Where the GDPR or UK GDPR applies, we process personal data on the basis of: your consent (for
                non-essential cookies and newsletters), our legitimate interests (running and improving the Site,
                measuring audience, securing the service), and compliance with legal obligations.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">8. Sharing of Information</h3>
              <p>We do not sell personal information. We share data only with:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Service providers that host the Site, deliver email, run analytics or serve ads on our behalf.</li>
                <li>Authorities, when required by law or to protect rights, safety and property.</li>
                <li>Successors in the event of a merger, acquisition or asset sale, subject to this policy.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">9. Data Retention</h3>
              <p>
                We keep personal data only for as long as necessary for the purposes described above, to comply with
                legal obligations, to resolve disputes and to enforce our agreements. Server logs are typically
                retained for a short period and then deleted or aggregated.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">10. Your Rights</h3>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Access the personal data we hold about you.</li>
                <li>Request correction or deletion of your data.</li>
                <li>Object to or restrict certain processing.</li>
                <li>Withdraw consent at any time (without affecting prior processing).</li>
                <li>Lodge a complaint with your local data protection authority.</li>
              </ul>
              <p className="mt-3">
                To exercise any right, email us at{" "}
                <a href={`mailto:${SITE.email}`} className="text-primary hover:underline">{SITE.email}</a>.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">11. Children's Privacy</h3>
              <p>
                Our content is not directed to children under 13 (or the equivalent minimum age in your country) and
                we do not knowingly collect personal data from them. If you believe a child has provided us data,
                contact us and we will delete it.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">12. International Transfers</h3>
              <p>
                Your information may be processed in countries other than your own, including jurisdictions whose data
                protection laws differ from yours. Where required, we rely on appropriate safeguards such as standard
                contractual clauses.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">13. Security</h3>
              <p>
                We use reasonable technical and organisational measures to protect personal data. However, no method
                of transmission or storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">14. Third-Party Links</h3>
              <p>
                Our articles may link to external websites. We are not responsible for the privacy practices or content
                of those sites, and we encourage you to review their privacy policies.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-headline mb-3">15. Changes to This Policy</h3>
              <p>
                We may update this Privacy Policy from time to time. The "last updated" date at the top reflects the
                most recent revision. Material changes will be highlighted on the Site.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="card-base p-8 bg-primary/5 border-primary/20">
          <h3 className="font-serif font-bold text-headline mb-3">Questions about your privacy?</h3>
          <p className="text-foreground/85 mb-4">
            For any questions, requests or complaints about this Privacy Policy or our data practices, contact our editorial team.
          </p>
          <div className="space-y-2">
            <p><strong>{SITE.name}</strong> — {SITE.publisher}</p>
            <p>Email: <a href={`mailto:${SITE.email}`} className="text-primary underline hover:no-underline">{SITE.email}</a></p>
            <p>Website: <a href={SITE.url} className="text-primary underline hover:no-underline">{SITE.url}</a></p>
          </div>
          <div className="mt-4">
            <Link to="/contact" className="text-primary underline hover:no-underline">
              Contact us →
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
