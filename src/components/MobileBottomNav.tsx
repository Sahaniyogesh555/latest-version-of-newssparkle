import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bookmark, User, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: Bookmark, label: "Saved", href: "/bookmarks" },
  { icon: User, label: "Profile", href: "/authors" },
  { icon: Menu, label: "More", href: "/about" },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = location.pathname === href ||
            (href !== "/" && location.pathname.startsWith(href));

          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-0 flex-1",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-foreground/60 hover:text-primary hover:bg-primary/5"
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}