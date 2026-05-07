import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";

export default function Privacy() {
  const lastUpdated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <Layout>
      <SEO
        title="Privacy Policy"
        description={`Read the ${SITE.name} privacy policy: what data we collect, how cookies and analytics work, advertising disclosures, your rights and how to contact us.`}
        path="/privacy"
      />
      <div className="container-prose py-14">
        <span className="kicker text-primary">Legal</span>
        <h1 className="headline-hero mt-2">Privacy Policy</h1>
        <p className="text-sm text-byline mt-3">Last updated: {lastUpdated}</p>

        <div className="prose-article mt-8">
          <p>
            This Privacy Policy describes how <strong>{SITE.name}</strong> ("we", "us", "our") collects, uses,
            shares and protects information when you visit <a href={SITE.url}>{SITE.url}</a> (the "Site"). By using
            the Site you agree to the practices described below.
          </p>

          <h2>1. Who We Are</h2>
          <p>
            {SITE.name} is an independent digital news publication operated by the {SITE.publisher}. For any privacy
            related question you can reach us at{" "}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Information you provide</h3>
          <ul>
            <li><strong>Contact form data</strong> — name, email address and the content of your message when you contact us.</li>
            <li><strong>Newsletter / subscription data</strong> — email address if you sign up for updates.</li>
            <li><strong>Correspondence</strong> — any information you send us by email.</li>
          </ul>

          <h3>2.2 Information collected automatically</h3>
          <ul>
            <li><strong>Log data</strong> — IP address, browser type and version, operating system, referring URL, pages visited, date and time of access.</li>
            <li><strong>Device data</strong> — device type, screen size, language and approximate location derived from IP.</li>
            <li><strong>Usage data</strong> — clicks, scroll depth, session duration and similar interaction signals.</li>
          </ul>

          <h2>3. Cookies & Similar Technologies</h2>
          <p>
            We use cookies, local storage and similar technologies to operate the Site, remember your preferences,
            measure traffic and (where applicable) serve advertising. Cookies we use include:
          </p>
          <ul>
            <li><strong>Strictly necessary cookies</strong> — required for core functionality such as remembering your cookie consent choice and preferred language.</li>
            <li><strong>Analytics cookies</strong> — help us understand which articles are read, so we can improve our coverage. These may be set by Google Analytics or a similar provider.</li>
            <li><strong>Advertising cookies</strong> — set by Google AdSense and its partners to show relevant ads and measure ad performance.</li>
            <li><strong>Preference cookies</strong> — remember settings such as your selected language for the on-site translator.</li>
          </ul>
          <p>
            You can control cookies through your browser settings and, where shown, through our on-site cookie
            consent banner. Disabling some cookies may affect Site functionality.
          </p>

          <h2>4. Analytics</h2>
          <p>
            We may use Google Analytics and other privacy-respecting analytics tools to understand aggregate
            readership. These tools collect information such as pages viewed, time on page and approximate
            location, and process it on our behalf. You can opt out of Google Analytics by installing the{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
              Google Analytics Opt-out Browser Add-on
            </a>.
          </p>

          <h2>5. Advertising & Google AdSense</h2>
          <p>
            We may display advertising served by Google AdSense and other third-party ad networks. These vendors,
            including Google, use cookies to serve ads based on your prior visits to this and other websites.
            Google's use of advertising cookies enables it and its partners to serve ads to our users based on
            their visits to our sites and/or other sites on the Internet.
          </p>
          <p>
            You can opt out of personalised advertising by visiting{" "}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>{" "}
            or, for many other networks, <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer">aboutads.info</a>{" "}
            and <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer">youronlinechoices.eu</a>.
          </p>

          <h2>6. How We Use Information</h2>
          <ul>
            <li>To operate, maintain and improve the Site and our content.</li>
            <li>To respond to enquiries, feedback and correction requests.</li>
            <li>To measure readership and understand which topics matter most to you.</li>
            <li>To prevent fraud, abuse and security incidents.</li>
            <li>To comply with legal obligations.</li>
          </ul>

          <h2>7. Legal Bases (EEA / UK Readers)</h2>
          <p>
            Where the GDPR or UK GDPR applies, we process personal data on the basis of: your consent (for
            non-essential cookies and newsletters), our legitimate interests (running and improving the Site,
            measuring audience, securing the service), and compliance with legal obligations.
          </p>

          <h2>8. Sharing of Information</h2>
          <p>We do not sell personal information. We share data only with:</p>
          <ul>
            <li>Service providers that host the Site, deliver email, run analytics or serve ads on our behalf.</li>
            <li>Authorities, when required by law or to protect rights, safety and property.</li>
            <li>Successors in the event of a merger, acquisition or asset sale, subject to this policy.</li>
          </ul>

          <h2>9. Data Retention</h2>
          <p>
            We keep personal data only for as long as necessary for the purposes described above, to comply with
            legal obligations, to resolve disputes and to enforce our agreements. Server logs are typically
            retained for a short period and then deleted or aggregated.
          </p>

          <h2>10. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Withdraw consent at any time (without affecting prior processing).</li>
            <li>Lodge a complaint with your local data protection authority.</li>
          </ul>
          <p>
            To exercise any right, email us at{" "}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>

          <h2>11. Children's Privacy</h2>
          <p>
            Our content is not directed to children under 13 (or the equivalent minimum age in your country) and
            we do not knowingly collect personal data from them. If you believe a child has provided us data,
            contact us and we will delete it.
          </p>

          <h2>12. International Transfers</h2>
          <p>
            Your information may be processed in countries other than your own, including jurisdictions whose data
            protection laws differ from yours. Where required, we rely on appropriate safeguards such as standard
            contractual clauses.
          </p>

          <h2>13. Security</h2>
          <p>
            We use reasonable technical and organisational measures to protect personal data. However, no method
            of transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2>14. Third-Party Links</h2>
          <p>
            Our articles may link to external websites. We are not responsible for the privacy practices or content
            of those sites, and we encourage you to review their privacy policies.
          </p>

          <h2>15. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The "last updated" date at the top reflects the
            most recent revision. Material changes will be highlighted on the Site.
          </p>

          <h2>16. Contact Us</h2>
          <p>
            For any questions, requests or complaints about this Privacy Policy or our data practices, contact:
          </p>
          <p>
            <strong>{SITE.name}</strong> — {SITE.publisher}<br />
            Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a><br />
            Website: <a href={SITE.url}>{SITE.url}</a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
