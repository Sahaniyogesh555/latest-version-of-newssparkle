import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import { useState } from "react";
import { toast } from "sonner";

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Layout>
      <SEO title="Contact" description={`Get in touch with the ${SITE.name} editorial desk for tips, corrections, or partnership inquiries.`} path="/contact" />
      <div className="container-prose py-14">
        <span className="kicker text-primary">Contact</span>
        <h1 className="headline-hero mt-2">Contact us</h1>
        <p className="mt-5 text-lg text-foreground/80">We welcome news tips, corrections, feedback and partnership inquiries.</p>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-xl font-bold">Editorial</h2>
            <p className="mt-2 text-foreground/80">For tips, story ideas and corrections.</p>
            <a href={`mailto:${SITE.email}`} className="mt-2 inline-block text-primary font-semibold">{SITE.email}</a>
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold">Partnerships</h2>
            <p className="mt-2 text-foreground/80">Advertising, syndication and collaborations.</p>
            <a href={`mailto:${SITE.email}`} className="mt-2 inline-block text-primary font-semibold">{SITE.email}</a>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setSubmitting(true); setTimeout(() => { setSubmitting(false); toast.success("Thanks — we'll be in touch."); (e.target as HTMLFormElement).reset(); }, 600); }} className="mt-12 space-y-4 border-t border-border pt-10">
          <h2 className="font-serif text-xl font-bold">Send a message</h2>
          <input required name="name" placeholder="Your name" className="w-full border border-input bg-background px-4 py-3 focus:border-primary focus:outline-none" />
          <input required type="email" name="email" placeholder="Email address" className="w-full border border-input bg-background px-4 py-3 focus:border-primary focus:outline-none" />
          <textarea required name="message" rows={5} placeholder="Your message" className="w-full border border-input bg-background px-4 py-3 focus:border-primary focus:outline-none" />
          <button disabled={submitting} className="bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
