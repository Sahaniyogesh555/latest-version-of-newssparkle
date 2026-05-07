import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { SITE } from "@/lib/site";
import logo from "@/assets/logo.png";

const COLORS = [
  { name: "Deep Navy", token: "--headline", hex: "#0B1B3B", use: "Headlines, primary brand mark" },
  { name: "Sparkle Blue", token: "--primary", hex: "#1E5BFF", use: "Links, CTAs, accent" },
  { name: "Signal Red", token: "--cat-politics", hex: "#DC2626", use: "Breaking & National badge" },
  { name: "Spark Gold", token: "--accent", hex: "#F5B400", use: "Sparkle highlights" },
  { name: "Paper", token: "--background", hex: "#FFFFFF", use: "Default surface" },
  { name: "Ink", token: "--foreground", hex: "#111827", use: "Body copy" },
  { name: "Byline", token: "--byline", hex: "#6B7280", use: "Meta, captions, secondary" },
  { name: "Rule", token: "--rule", hex: "#E5E7EB", use: "Dividers, hairlines" },
];

const LOGO_SIZES = [
  { context: "Mobile header", size: "40 px height", note: "h-10, auto width" },
  { context: "Tablet header", size: "48 px height", note: "sm:h-12" },
  { context: "Desktop header", size: "56 px height", note: "md:h-14" },
  { context: "Footer", size: "32–40 px height", note: "Optional, small variant" },
  { context: "Favicon", size: "32 × 32 px", note: "/favicon.png" },
  { context: "Open Graph", size: "1200 × 630 px", note: "Social share card" },
  { context: "Min clear space", size: "≥ 0.5× logo height", note: "On all sides" },
];

const TYPOGRAPHY = [
  { role: "Display / Headlines", family: "Playfair Display (serif)", weight: "700–900", note: "Article H1, hero kickers" },
  { role: "UI / Body", family: "Inter (sans-serif)", weight: "400 / 600", note: "Paragraphs, navigation, UI" },
  { role: "Kicker / Eyebrow", family: "Inter", weight: "600 uppercase, tracking-wider", note: "Section labels, dates" },
];

export default function Brand() {
  return (
    <Layout>
      <SEO
        title={`Brand Guidelines | ${SITE.name}`}
        description={`Brand guidelines for ${SITE.name}: logo dimensions, color palette, and typography system.`}
        path="/brand"
        keywords={["brand", "guidelines", "logo", "colors", "typography", SITE.name]}
      />
      <div className="container-prose py-12 sm:py-16">
        <p className="kicker text-byline">Internal · v1.0</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-black tracking-tight text-headline mt-2">Brand Settings</h1>
        <p className="mt-4 text-lg text-foreground/80">
          The visual standards that keep {SITE.name} crisp, consistent, and editorial across every surface.
        </p>

        {/* LOGO */}
        <section className="mt-14">
          <div className="rule-top mb-6"><h2 className="font-serif text-2xl font-bold">Logo</h2></div>
          <div className="grid gap-6 md:grid-cols-[280px_1fr] items-start">
            <div className="bg-secondary border border-border p-6 flex items-center justify-center aspect-square">
              <img src={logo} alt={`${SITE.name} logo`} className="max-h-40 w-auto" />
            </div>
            <div>
              <p className="text-sm text-foreground/85 leading-relaxed">
                Always render the logo on a clean light surface with generous clear space. Never recolor, stretch, rotate, or apply effects. Use the PNG at <code className="bg-muted px-1.5 py-0.5 text-xs">/logo.png</code>.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="py-2 pr-4 kicker text-byline">Context</th>
                      <th className="py-2 pr-4 kicker text-byline">Size</th>
                      <th className="py-2 kicker text-byline">Token / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LOGO_SIZES.map(s => (
                      <tr key={s.context} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-semibold text-headline">{s.context}</td>
                        <td className="py-2 pr-4">{s.size}</td>
                        <td className="py-2 text-byline">{s.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* COLORS */}
        <section className="mt-14">
          <div className="rule-top mb-6"><h2 className="font-serif text-2xl font-bold">Color Palette</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLORS.map(c => (
              <div key={c.name} className="border border-border flex overflow-hidden">
                <div className="w-20 shrink-0" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                <div className="p-4 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-headline">{c.name}</h3>
                    <code className="text-xs text-byline">{c.hex}</code>
                  </div>
                  <p className="text-xs text-byline mt-1"><code>{c.token}</code></p>
                  <p className="text-sm text-foreground/80 mt-2">{c.use}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TYPOGRAPHY */}
        <section className="mt-14">
          <div className="rule-top mb-6"><h2 className="font-serif text-2xl font-bold">Typography</h2></div>
          <div className="space-y-5">
            {TYPOGRAPHY.map(t => (
              <div key={t.role} className="border border-border p-5">
                <div className="kicker text-byline">{t.role}</div>
                <div className="font-serif text-2xl font-bold text-headline mt-1">{t.family}</div>
                <p className="text-sm text-foreground/80 mt-2">
                  <span className="font-semibold">Weight:</span> {t.weight} · {t.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-secondary border-l-4 border-primary">
            <p className="kicker text-byline mb-2">Sample headline</p>
            <p className="font-serif text-3xl font-black text-headline leading-tight">The world, sparkling with clarity every morning.</p>
            <p className="mt-3 text-foreground/85">Body copy uses Inter at 16–18 px with comfortable line-height for long-form reading. Kickers are uppercase, letter-spaced, and small.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
