import { isDemoMode } from "@/lib/demo/demoClient";

/**
 * Loud, unmissable notice that the site is rendering sample content.
 * Renders nothing in a normal build.
 */
export function DemoModeBanner() {
  if (!isDemoMode) return null;

  return (
    <div
      role="status"
      className="bg-destructive text-destructive-foreground text-center text-xs sm:text-sm font-semibold tracking-wide px-4 py-2"
    >
      DEMO MODE — sample data, not real news. Unset VITE_DEMO_MODE to use the live database.
    </div>
  );
}
