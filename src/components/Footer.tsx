import { Link } from "react-router-dom";
import { CATEGORIES, SITE } from "@/lib/site";
import { Mail, Twitter, Facebook, Linkedin, Rss, MapPin, Phone, Globe } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-rule bg-secondary/20">
      {/* Main footer content */}
      <div className="container-wide py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Brand and newsletter */}
          <div className="lg:col-span-2">
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
              <p className="text-sm text-foreground/70 mb-4">
                Get breaking news and analysis delivered to your inbox.
              </p>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
                >
                  Subscribe
                </button>
              </form>
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
                <a href="/security.txt" className="text-foreground/80 hover:text-primary transition-colors">
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
                Trending Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {["Breaking News", "Politics", "Technology", "Business", "Health", "Entertainment"].map(topic => (
                  <Link
                    key={topic}
                    to={`/tag/${encodeURIComponent(topic.toLowerCase().replace(' ', '-'))}`}
                    className="px-3 py-1 text-xs bg-muted text-foreground/70 hover:bg-primary hover:text-primary-foreground transition-colors rounded"
                  >
                    #{topic}
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

            <div className="flex items-center gap-6">
              {/* Social links */}
              <div className="flex items-center gap-3">
                <a href={`https://twitter.com/${SITE.twitter?.replace('@', '')}`} className="text-foreground/60 hover:text-primary transition-colors">
                  <Twitter className="size-4" />
                </a>
                <a href="#" className="text-foreground/60 hover:text-primary transition-colors">
                  <Facebook className="size-4" />
                </a>
                <a href="#" className="text-foreground/60 hover:text-primary transition-colors">
                  <Linkedin className="size-4" />
                </a>
                <a href="/functions/v1/rss" className="text-foreground/60 hover:text-primary transition-colors">
                  <Rss className="size-4" />
                </a>
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
