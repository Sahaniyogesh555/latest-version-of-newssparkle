import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "./CookieConsent";
import { PushNotificationsPrompt } from "./PushNotificationsPrompt";
import { BackToTop } from "./BackToTop";
import { BreakingNewsAlerts } from "./BreakingNewsAlerts";
import { MobileBottomNav } from "./MobileBottomNav";
import { DemoModeBanner } from "./DemoModeBanner";
import { SITE } from "@/lib/site";

export function Layout({ children }: { children: ReactNode }) {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE.name,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    sameAs: [`https://twitter.com/${SITE.twitter.replace(/^@/, "")}`],
  };
  return (
    <div className="min-h-screen flex flex-col bg-background pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-0">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(orgLd)}</script>
      </Helmet>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-3 focus:py-2 focus:bg-card focus:text-foreground focus:border focus:border-primary rounded-md"
      >
        Skip to main content
      </a>
      <DemoModeBanner />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">{children}</main>
      <Footer />
      <MobileBottomNav />
      <CookieConsent />
      <PushNotificationsPrompt />
      <BreakingNewsAlerts />
      <BackToTop />
    </div>
  );
}
