import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "ns_theme_v1";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    localStorage.setItem(KEY, theme);
    // Update browser UI (mobile address bar) to match theme
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?? Object.assign(document.createElement("meta"), { name: "theme-color" });
    if (!meta.isConnected) document.head.appendChild(meta);
    meta.content = theme === "dark" ? "#121110" : "#f8f5f0";
  }, [theme]);

  // Live-sync with OS preference if user hasn't explicitly chosen
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(KEY)) setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return { theme, setTheme, toggle: () => setTheme(t => t === "dark" ? "light" : "dark") };
}
