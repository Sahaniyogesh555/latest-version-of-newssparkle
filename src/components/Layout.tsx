import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "./CookieConsent";
import { PushNotificationsPrompt } from "./PushNotificationsPrompt";
import { BackToTop } from "./BackToTop";
import { BreakingNewsAlerts } from "./BreakingNewsAlerts";
import { MobileBottomNav } from "./MobileBottomNav";
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
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(orgLd)}</script>
      </Helmet>
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <CookieConsent />
      <PushNotificationsPrompt />
      <BreakingNewsAlerts />
      <BackToTop />
    </div>
  );
}
