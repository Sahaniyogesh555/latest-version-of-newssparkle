import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Bookmark, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { CATEGORIES, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { HeaderSearch } from "./HeaderSearch";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  useEffect(() => setOpen(false), [location.pathname]);

  // Split brand name into two parts: e.g. "NewsSparkle" → "News" + "Sparkle"
  const parts = SITE.name.match(/^([A-Z][a-z]*)(.*)$/);
  const brandLead = parts?.[1] ?? SITE.name;
  const brandAccent = parts?.[2] ?? "";

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-wide">
        <div className="flex items-center justify-between py-5 sm:py-6">
          <Link
            to="/"
            aria-label={`${SITE.name} — home`}
            className="flex items-baseline gap-1.5 select-none"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            <span className="text-xl sm:text-2xl md:text-[28px] font-black tracking-tight text-headline">
              {brandLead}
            </span>
            {brandAccent && (
              <span className="text-xl sm:text-2xl md:text-[28px] font-black tracking-tight text-primary">
                {brandAccent}
              </span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {CATEGORIES.map(c => (
              <NavLink
                key={c.slug}
                to={`/category/${c.slug}`}
                className={({ isActive }) =>
                  cn(
                    "text-[15px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-headline hover:text-primary"
                  )
                }
              >
                {c.name}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <HeaderSearch />
            <Link to="/bookmarks" aria-label="Saved articles" className="p-1.5 text-headline hover:text-primary transition-colors hidden sm:inline-flex">
              <Bookmark className="size-5" />
            </Link>
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 text-headline hover:text-primary transition-colors"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <LanguageToggle />
            <button
              className="md:hidden p-1.5 -mr-1.5"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden flex flex-col gap-3 pb-4 border-t border-border pt-4">
            {CATEGORIES.map(c => (
              <NavLink
                key={c.slug}
                to={`/category/${c.slug}`}
                className={({ isActive }) =>
                  cn(
                    "text-[15px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-headline hover:text-primary"
                  )
                }
              >
                {c.name}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
