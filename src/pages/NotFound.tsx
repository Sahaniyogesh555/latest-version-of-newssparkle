import { Link, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";

export default function NotFound() {
  const location = useLocation();
  return (
    <Layout>
      <SEO title="Page not found" description="This page could not be found. Browse the latest stories or search the NewsSparkle archive." path={location.pathname} robots="noindex, follow" />
      <div className="container-prose py-20 sm:py-28 text-center">
        <p className="kicker text-primary mb-3">404 · Page not found</p>
        <h1 className="headline-lg mb-4">This page is missing</h1>
        <p className="mb-8 text-foreground/75">The link may be out of date, or this page may have moved. Let’s get you back to the news.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">Return to Home</Link>
          <Link to="/search" className="btn border border-border hover:border-primary hover:text-primary">Search stories</Link>
        </div>
      </div>
    </Layout>
  );
}
