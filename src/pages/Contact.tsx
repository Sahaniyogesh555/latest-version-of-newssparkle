import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { useState } from "react";
import { useClipboard } from "@/hooks/use-clipboard";
import { Mail, MessageSquare, Lightbulb, AlertCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function Contact() {
  const [draft, setDraft] = useState<{ href: string; text: string } | null>(null);
  const { copied, copyFailed, copy } = useClipboard(draft?.text || "");

  const prepareEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const subjectField = form.elements.namedItem("subject") as HTMLSelectElement;
    const subject = `${SITE.name}: ${subjectField.selectedOptions[0].text}`;
    const body = `Name: ${String(values.get("name") || "").trim()}\nReply email: ${String(values.get("email") || "").trim()}\n\n${String(values.get("message") || "").trim()}`;
    setDraft({
      href: `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      text: `To: ${SITE.email}\nSubject: ${subject}\n\n${body}`,
    });
  };

  const contactCategories = [
    {
      icon: Lightbulb,
      title: "News Tips & Story Ideas",
      desc: "Have information about a breaking story or emerging trend? Share it with our newsroom.",
    },
    {
      icon: AlertCircle,
      title: "Corrections & Clarifications",
      desc: "Spot a factual error? We correct mistakes immediately. Tell us.",
    },
    {
      icon: Mail,
      title: "Feedback & Suggestions",
      desc: "Comments on our coverage, feature requests, or editorial feedback.",
    },
    {
      icon: Lock,
      title: "Press Inquiries & Licensing",
      desc: "Media inquiries, content licensing, or reproduction permissions.",
    },
  ];

  return (
    <Layout>
      <SEO
        title="Contact NewsSparkle"
        description={`Get in touch with the ${SITE.name} editorial desk for news tips, corrections, and partnership inquiries. Use email for news tips, corrections, and feedback.`}
        path="/contact"
        keywords={["contact", "news tips", "corrections", "feedback", SITE.name]}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-secondary/30 to-transparent border-b border-border">
        <div className="container-prose py-16 sm:py-24">
          <span className="kicker text-primary">Get in Touch</span>
          <h1 className="headline-hero mt-3 mb-6">Contact our newsroom</h1>
          <p className="text-xl text-foreground/80 leading-relaxed max-w-2xl">
            We welcome news tips, corrections, feedback, and partnership inquiries. Reach out to
            our editorial desk.
          </p>
        </div>
      </section>

      {/* Main content */}
      <div className="container-prose py-12 sm:py-16">
        {/* Contact categories */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">What can we help with?</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {contactCategories.map((cat, i) => (
              <div key={i} className="card-base p-6">
                <cat.icon className="size-6 text-primary mb-3" />
                <h3 className="font-serif font-bold text-headline mb-2">{cat.title}</h3>
                <p className="text-sm text-foreground/80">{cat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Direct contact info */}
        <section className="mb-16 pb-16 border-b border-rule">
          <h2 className="headline-lg mb-8">Reach us directly</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card-base p-8 border-l-4 border-primary">
              <h3 className="font-serif text-lg font-bold text-headline mb-2">
                Editorial & News Tips
              </h3>
              <p className="text-foreground/80 mb-4">
                Send news tips, story ideas, or corrections to our editorial desk.
              </p>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-block max-w-full break-all text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                {SITE.email}
              </a>
            </div>

            <div className="card-base p-8">
              <h3 className="font-serif text-lg font-bold text-headline mb-2">
                Response Time
              </h3>
              <p className="text-foreground/80 mb-4">
                We aim to respond to legitimate inquiries within 48 hours. Email is not a secure
                whistleblowing channel; please avoid sharing sensitive personal information.
              </p>
              <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                Share only what is necessary
              </span>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section className="mb-16">
          <h2 className="headline-lg mb-4">Send us a message</h2>
          <p id="contact-help" className="text-sm text-byline mb-6">This form prepares an email draft. Nothing is sent or stored by this website. Review and send it from your own email app.</p>
          <form
            onSubmit={prepareEmail}
            onChange={() => setDraft(null)}
            aria-describedby="contact-help"
            className="card-base p-5 sm:p-10"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-semibold text-headline mb-2">
                  Your name
                </label>
                <input
                  required
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  type="text"
                  placeholder="e.g., Jane Smith"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-semibold text-headline mb-2">
                  Email address
                </label>
                <input
                  required
                  type="email"
                  id="contact-email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="contact-subject" className="block text-sm font-semibold text-headline mb-2">Subject</label>
              <select
                id="contact-subject"
                name="subject"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="news-tip">News Tip</option>
                <option value="correction">Correction</option>
                <option value="feedback">Feedback</option>
                <option value="partnership">Partnership Inquiry</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mt-6">
              <label htmlFor="contact-message" className="block text-sm font-semibold text-headline mb-2">Message</label>
              <textarea
                required
                id="contact-message"
                name="message"
                maxLength={3000}
                rows={7}
                placeholder="Tell us what's on your mind..."
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              className="mt-6 btn-primary px-6 py-3 w-full sm:w-auto"
            >
              Prepare email
            </button>

            <p className="text-xs text-byline mt-4">
              Please review our{" "}
              <Link to="/privacy" className="text-primary underline hover:no-underline">
                Privacy Policy
              </Link>
              . Your email provider handles delivery.
            </p>
          </form>
          {draft && (
            <div className="mt-6 rounded-lg border border-border bg-card p-5" role="status">
              <p className="font-semibold text-headline">Your email draft is ready. It has not been sent.</p>
              <p className="mt-2 text-sm text-byline">Open your email app, review the draft, then send it. If no email app is configured, copy the message and email {SITE.email}.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={draft.href} className="btn-primary">Open email app</a>
                <button type="button" onClick={copy} className="btn border border-border">{copied ? "Copied" : "Copy message"}</button>
              </div>
              {copyFailed && (
                <div className="mt-4">
                  <label htmlFor="contact-draft" className="block text-sm text-byline mb-2">Clipboard unavailable. Select and copy your draft below.</label>
                  <textarea id="contact-draft" readOnly value={draft.text} rows={8} onFocus={event => event.currentTarget.select()} className="w-full min-w-0 border border-border rounded bg-background p-3 text-sm" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Security & privacy assurance */}
        <section className="card-base p-6 bg-primary/5 border-primary/20">
          <h3 className="font-serif font-bold text-headline mb-3">Before you share</h3>
          <p className="text-sm text-foreground/85 mb-4">
            This site prepares a draft only; your email app and provider handle sending and
            storage. Their privacy and security policies also apply. Do not include passwords,
            identity documents, or other sensitive personal information.
          </p>
          <Link to="/privacy" className="text-sm text-primary underline hover:no-underline">
            Read our full Privacy Policy
          </Link>
        </section>
      </div>
    </Layout>
  );
}
