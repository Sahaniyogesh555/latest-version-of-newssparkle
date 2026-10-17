import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Bookmark, Sun, Moon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { HeaderSearch } from "./HeaderSearch";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [location.key]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-height");
    };
  }, []);

  const parts = SITE.name.match(/^([A-Z][a-z]*)(.*)$/);
  const brandLead = parts?.[1] ?? SITE.name;
  const brandAccent = parts?.[2] ?? "";
  const navClass = ({ isActive }: { isActive: boolean }) => cn(
    "text-sm font-medium transition-colors py-2",
    isActive ? "text-primary" : "text-headline hover:text-primary",
  );

  return (
    <header ref={headerRef} className="border-b border-border bg-background sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="container-wide">
        <div className="flex items-center justify-between gap-2 py-4 sm:py-5">
          <Link to="/" className="flex min-w-0 flex-col gap-1 select-none" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            <span className="flex items-baseline gap-1 text-xl sm:text-2xl lg:text-[28px] font-black tracking-tight text-headline">
              <span>{brandLead}</span>{brandAccent && <span className="text-primary">{brandAccent}</span>}
              <span className="sr-only">home</span>
            </span>
            <span className="hidden md:block text-[10px] uppercase tracking-[0.22em] text-byline">{SITE.tagline}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <HeaderSearch />
            <Link to="/bookmarks" aria-label="Saved articles" className="p-2 text-headline hover:text-primary transition-colors hidden sm:inline-flex">
              <Bookmark className="size-5" />
            </Link>
            <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="p-2 text-headline hover:text-primary transition-colors">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <Link to="/about" className="hidden lg:inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-headline hover:border-primary hover:text-primary transition-colors">About</Link>
            <LanguageToggle />
            <button ref={menuRef} type="button" className="lg:hidden p-2 text-headline" onClick={() => setOpen(value => !value)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="primary-menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Long section names get their own row instead of squeezing brand/actions off-screen. */}
        <nav aria-label="Primary navigation" className="hidden lg:flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-border py-2">
          {CATEGORIES.map(c => <NavLink key={c.slug} to={`/category/${c.slug}`} className={navClass}>{c.name}</NavLink>)}
        </nav>
        <nav id="primary-menu" aria-label="Mobile sections" className={cn("lg:hidden flex-col gap-1 pb-4 border-t border-border pt-3 max-h-[65dvh] overflow-y-auto", open ? "flex" : "hidden")}>
          {CATEGORIES.map(c => <NavLink key={c.slug} to={`/category/${c.slug}`} className={navClass}>{c.name}</NavLink>)}
          <NavLink to="/about" className={navClass}>About</NavLink>
          <NavLink to="/contact" className={navClass}>Contact</NavLink>
        </nav>
      </div>
    </header>
  );
}
