import { Link } from "react-router-dom";
import { CATEGORIES, SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-rule bg-secondary/40">
      <div className="container-wide py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <h2 className="font-serif text-2xl font-black tracking-tighter text-headline">{SITE.name}</h2>
          <p className="mt-3 text-sm text-byline max-w-md">{SITE.description}</p>
        </div>
        <div>
          <h3 className="kicker text-headline mb-3">Sections</h3>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.map(c => (
              <li key={c.slug}><Link to={`/category/${c.slug}`} className="text-foreground hover:text-primary">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="kicker text-headline mb-3">Company</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="hover:text-primary">About</Link></li>
            <li><Link to="/authors" className="hover:text-primary">Authors</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
            <li><Link to="/faq" className="hover:text-primary">FAQ</Link></li>
            <li><Link to="/editorial-policy" className="hover:text-primary">Editorial Policy</Link></li>
            <li><Link to="/corrections" className="hover:text-primary">Corrections</Link></li>
            <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
            <li><Link to="/disclaimer" className="hover:text-primary">Disclaimer</Link></li>
            <li><a href="/sitemap.xml" className="hover:text-primary">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-wide py-5 text-xs text-byline flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
          <span>Made with editorial care.</span>
        </div>
      </div>
    </footer>
  );
}
