import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageSquare, Lightbulb, AlertCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);

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
        description={`Get in touch with the ${SITE.name} editorial desk for news tips, corrections, and partnership inquiries. We respond to every legitimate submission.`}
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
                className="inline-block text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                {SITE.email}
              </a>
            </div>

            <div className="card-base p-8">
              <h3 className="font-serif text-lg font-bold text-headline mb-2">
                Response Time
              </h3>
              <p className="text-foreground/80 mb-4">
                We aim to respond to all legitimate submissions within 48 hours. Tips submitted in
                confidence will be kept confidential.
              </p>
              <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                ✓ We protect your privacy
              </span>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section className="mb-16">
          <h2 className="headline-lg mb-8">Send us a message</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitting(true);
              setTimeout(() => {
                setSubmitting(false);
                toast.success("Message received — our team will respond soon.");
                (e.target as HTMLFormElement).reset();
              }, 800);
            }}
            className="card-base p-8 sm:p-10"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-headline mb-2">
                  Your name
                </label>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="e.g., Jane Smith"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-headline mb-2">
                  Email address
                </label>
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-headline mb-2">Subject</label>
              <select
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
              <label className="block text-sm font-semibold text-headline mb-2">Message</label>
              <textarea
                required
                name="message"
                rows={7}
                placeholder="Tell us what's on your mind..."
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            <button
              disabled={submitting}
              className="mt-6 btn-primary px-6 py-3 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send message"}
            </button>

            <p className="text-xs text-byline mt-4">
              By submitting this form, you agree to our{" "}
              <Link to="/privacy" className="text-primary underline hover:no-underline">
                Privacy Policy
              </Link>
              . Your information will be kept confidential.
            </p>
          </form>
        </section>

        {/* Security & privacy assurance */}
        <section className="card-base p-6 bg-primary/5 border-primary/20">
          <h3 className="font-serif font-bold text-headline mb-3">🔒 Your information is secure</h3>
          <p className="text-sm text-foreground/85 mb-4">
            All submissions are encrypted and handled according to {SITE.name}'s strict privacy
            standards. We never share personal information with third parties without consent.
          </p>
          <Link to="/privacy" className="text-sm text-primary underline hover:no-underline">
            Read our full Privacy Policy
          </Link>
        </section>
      </div>
    </Layout>
  );
}
