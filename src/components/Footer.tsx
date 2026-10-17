import { Link } from "react-router-dom";
import { CATEGORIES, SITE } from "@/lib/site";
import { Mail, Twitter, Rss, MapPin, Globe } from "lucide-react";
import { NewsUpdates } from "./NewsUpdates";
import { RSS_URL } from "@/lib/endpoints";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-rule bg-secondary/20">
      {/* Main footer content */}
      <div className="container-wide py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Brand and newsletter */}
          <div className="lg:col-span-2 min-w-0">
            <div className="mb-8">
              <h2 className="font-serif text-3xl font-black tracking-tighter text-headline mb-3">
                {SITE.name}
              </h2>
              <p className="text-foreground/80 leading-relaxed max-w-md">
                {SITE.description}
              </p>
              <p className="mt-4 text-sm text-foreground/70 max-w-lg">
                A newsroom-first destination for timely coverage, trusted context, and editorial accountability. Stories are curated for mobile readers and search-ready audiences.
              </p>
            </div>

            {/* Newsletter signup */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="size-5 text-primary" />
                <h3 className="font-semibold text-headline">Stay Informed</h3>
              </div>
              <NewsUpdates />
            </div>
          </div>

          {/* Categories and sections */}
          <div>
            <h3 className="font-semibold text-headline mb-4 uppercase tracking-wider text-sm">
              News Sections
            </h3>
            <ul className="space-y-3 text-sm">
              {CATEGORIES.map(c => (
                <li key={c.slug}>
                  <Link
                    to={`/category/${c.slug}`}
                    className="text-foreground/80 hover:text-primary transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/authors" className="text-foreground/80 hover:text-primary transition-colors">
                  Authors
                </Link>
              </li>
              <li>
                <Link to="/search" className="text-foreground/80 hover:text-primary transition-colors">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Company and resources */}
          <div>
            <h3 className="font-semibold text-headline mb-4 uppercase tracking-wider text-sm">
              Newsroom
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/about" className="text-foreground/80 hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-foreground/80 hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/editorial-policy" className="text-foreground/80 hover:text-primary transition-colors">
                  Editorial Policy
                </Link>
              </li>
              <li>
                <Link to="/corrections" className="text-foreground/80 hover:text-primary transition-colors">
                  Corrections
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-foreground/80 hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-foreground/80 hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-foreground/80 hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="/.well-known/security.txt" className="text-foreground/80 hover:text-primary transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Trending topics and latest stories */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-headline mb-4 uppercase tracking-wider text-sm">
                Explore Sections
              </h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(topic => (
                  <Link
                    key={topic.slug}
                    to={`/category/${topic.slug}`}
                    className="px-3 py-1 text-xs bg-muted text-foreground/70 hover:bg-primary hover:text-primary-foreground transition-colors rounded"
                  >
                    {topic.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-headline mb-4 uppercase tracking-wider text-sm">
                Latest Stories
              </h3>
              <div className="space-y-2 text-sm">
                <Link to="/category/breaking-news" className="block text-foreground/80 hover:text-primary transition-colors">
                  Breaking News Updates
                </Link>
                <Link to="/category/politics" className="block text-foreground/80 hover:text-primary transition-colors">
                  Political Analysis
                </Link>
                <Link to="/category/technology" className="block text-foreground/80 hover:text-primary transition-colors">
                  Tech Innovations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border bg-secondary/40">
        <div className="container-wide py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-foreground/60">
              <span>© {currentYear} {SITE.name}. All rights reserved.</span>
              <span>Global newsroom · editorial-first reporting</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  Global
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="size-3" />
                  English
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Social links */}
              <div className="flex items-center gap-3">
                {SITE.twitter && <a href={`https://twitter.com/${SITE.twitter.replace('@', '')}`} aria-label={`${SITE.name} on X`} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-foreground/70 hover:text-primary transition-colors">
                  <Twitter className="size-4" />
                </a>}
                {RSS_URL && <a href={RSS_URL} aria-label="NewsSparkle RSS feed" className="inline-flex p-2 text-foreground/70 hover:text-primary transition-colors">
                  <Rss className="size-4" />
                </a>}
              </div>

              {/* Sitemap and technical links */}
              <div className="flex items-center gap-4 text-xs text-foreground/60">
                <a href="/sitemap.xml" className="hover:text-primary transition-colors">
                  Sitemap
                </a>
                <a href="/robots.txt" className="hover:text-primary transition-colors">
                  Robots
                </a>
                <a href="/llms.txt" className="hover:text-primary transition-colors">
                  LLMs
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
