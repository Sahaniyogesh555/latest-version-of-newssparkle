// Validates sitemap.xml, news-sitemap, and RSS feed for common SEO/formatting issues.
// Returns a JSON report and logs errors to the function log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Issue = { level: "error" | "warning"; feed: string; message: string };

async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string; contentType: string }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "NewsSparkle-FeedValidator/1.0" } });
    return { ok: r.ok, status: r.status, body: await r.text(), contentType: r.headers.get("content-type") || "" };
  } catch (e) {
    return { ok: false, status: 0, body: String(e), contentType: "" };
  }
}

function checkXmlBasics(name: string, body: string, contentType: string, issues: Issue[]) {
  if (!body.trim().startsWith("<?xml")) {
    issues.push({ level: "error", feed: name, message: "Missing XML declaration <?xml ...?>" });
  }
  if (!/encoding=["']UTF-8["']/i.test(body.slice(0, 200))) {
    issues.push({ level: "warning", feed: name, message: "XML declaration should specify encoding=\"UTF-8\"" });
  }
  if (!/^(application\/(xml|rss\+xml|atom\+xml)|text\/xml)/i.test(contentType)) {
    issues.push({ level: "warning", feed: name, message: `Content-Type should be XML (got "${contentType}")` });
  }
  // Cheap well-formedness check: tag balance + unescaped ampersands outside CDATA
  const open = (body.match(/<[a-zA-Z][^/>]*?[^/]>/g) || []).length;
  const close = (body.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
  const selfClose = (body.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
  if (Math.abs(open - close) > selfClose + 2) {
    issues.push({ level: "error", feed: name, message: `Tag imbalance: ${open} open vs ${close} close` });
  }
  const stripped = body.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const badAmp = stripped.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
  if (badAmp && badAmp.length) {
    issues.push({ level: "error", feed: name, message: `${badAmp.length} unescaped ampersand(s) — must be &amp;` });
  }
}

function validateSitemap(name: string, body: string, contentType: string): Issue[] {
  const issues: Issue[] = [];
  checkXmlBasics(name, body, contentType, issues);
  const isIndex = /<sitemapindex[\s>]/i.test(body);
  const isUrlset = /<urlset[\s>]/i.test(body);
  if (!isIndex && !isUrlset) {
    issues.push({ level: "error", feed: name, message: "Missing <urlset> or <sitemapindex> root" });
    return issues;
  }
  if (!/xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/.test(body)) {
    issues.push({ level: "error", feed: name, message: "Missing required xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"" });
  }
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) {
    issues.push({ level: "error", feed: name, message: "No <loc> entries found" });
  }
  if (locs.length > 50000) {
    issues.push({ level: "error", feed: name, message: `${locs.length} URLs exceeds 50,000 limit` });
  }
  for (const loc of locs.slice(0, 200)) {
    if (!/^https?:\/\//.test(loc)) {
      issues.push({ level: "error", feed: name, message: `<loc> must be absolute URL: ${loc}` });
    }
    if (loc.length > 2048) {
      issues.push({ level: "warning", feed: name, message: `<loc> exceeds 2048 chars: ${loc.slice(0, 80)}…` });
    }
  }
  if (new TextEncoder().encode(body).length > 50 * 1024 * 1024) {
    issues.push({ level: "error", feed: name, message: "Sitemap exceeds 50 MB uncompressed" });
  }
  // News-sitemap specific
  if (name.includes("news")) {
    if (!/xmlns:news=["']http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9["']/.test(body)) {
      issues.push({ level: "error", feed: name, message: "Missing xmlns:news namespace for Google News sitemap" });
    }
    if (!/<news:publication>/.test(body)) {
      issues.push({ level: "warning", feed: name, message: "No <news:publication> entries — feed may be empty" });
    }
  }
  return issues;
}

function validateRss(name: string, body: string, contentType: string): Issue[] {
  const issues: Issue[] = [];
  checkXmlBasics(name, body, contentType, issues);
  if (!/<rss\s[^>]*version=["']2\.0["']/.test(body)) {
    issues.push({ level: "error", feed: name, message: "Missing <rss version=\"2.0\"> root element" });
  }
  if (!/<channel>/.test(body)) {
    issues.push({ level: "error", feed: name, message: "Missing <channel> element" });
  }
  for (const required of ["<title>", "<link>", "<description>"]) {
    if (!body.includes(required)) {
      issues.push({ level: "error", feed: name, message: `Missing required channel element ${required}` });
    }
  }
  if (!/<atom:link[^>]+rel=["']self["']/.test(body)) {
    issues.push({ level: "warning", feed: name, message: "Missing <atom:link rel=\"self\"> (recommended for RSS 2.0)" });
  }
  const items = [...body.matchAll(/<item>[\s\S]*?<\/item>/g)];
  if (items.length === 0) {
    issues.push({ level: "warning", feed: name, message: "Feed contains no <item> entries" });
  }
  items.slice(0, 50).forEach((m, i) => {
    const item = m[0];
    if (!/<title>/.test(item) && !/<description>/.test(item)) {
      issues.push({ level: "error", feed: name, message: `Item #${i + 1}: must have <title> or <description>` });
    }
    if (!/<guid[\s>]/.test(item) && !/<link>/.test(item)) {
      issues.push({ level: "warning", feed: name, message: `Item #${i + 1}: missing <guid> and <link>` });
    }
    const pub = item.match(/<pubDate>([^<]+)<\/pubDate>/);
    if (pub && isNaN(Date.parse(pub[1]))) {
      issues.push({ level: "error", feed: name, message: `Item #${i + 1}: invalid <pubDate> "${pub[1]}"` });
    }
  });
  return issues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const targets = [
    { name: "sitemap-index", url: `${SITE_URL}/sitemap.xml`, kind: "sitemap" as const },
    { name: "sitemap", url: `${SITE_URL}/functions/v1/sitemap`, kind: "sitemap" as const },
    { name: "news-sitemap", url: `${SITE_URL}/functions/v1/news-sitemap`, kind: "sitemap" as const },
    { name: "rss", url: `${SITE_URL}/functions/v1/rss`, kind: "rss" as const },
  ];

  const report: Array<{ feed: string; url: string; status: number; issues: Issue[]; bytes: number }> = [];
  for (const t of targets) {
    const res = await fetchText(t.url);
    const issues: Issue[] = [];
    if (!res.ok) {
      issues.push({ level: "error", feed: t.name, message: `HTTP ${res.status} fetching ${t.url}` });
    } else {
      const fn = t.kind === "rss" ? validateRss : validateSitemap;
      issues.push(...fn(t.name, res.body, res.contentType));
    }
    issues.forEach((i) => {
      const tag = i.level === "error" ? "❌" : "⚠️";
      console[i.level === "error" ? "error" : "warn"](`${tag} [${i.feed}] ${i.message}`);
    });
    report.push({ feed: t.name, url: t.url, status: res.status, issues, bytes: res.body.length });
  }

  const errors = report.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0);
  const warnings = report.reduce((n, r) => n + r.issues.filter((i) => i.level === "warning").length, 0);
  console.log(`Feed validation complete: ${errors} error(s), ${warnings} warning(s) across ${report.length} feeds`);

  // Best-effort persistence so the dashboard / edge logs both have a record.
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("feed_validation_runs").insert({
      total_errors: errors,
      total_warnings: warnings,
      report,
    });
  } catch (_) { /* table optional */ }

  return new Response(JSON.stringify({ ok: errors === 0, errors, warnings, report }, null, 2), {
    status: errors === 0 ? 200 : 422,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
