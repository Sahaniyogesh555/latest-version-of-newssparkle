import { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/storage";

type Theme = "light" | "dark";
const KEY = "ns_theme_v1";
const isTheme = (value: string | null): value is Theme => value === "light" || value === "dark";
const systemTheme = (): Theme =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function getInitial(): Theme {
  const stored = readStorage(KEY);
  return isTheme(stored) ? stored : systemTheme();
}

export function useTheme() {
  const [theme, setValue] = useState<Theme>(getInitial);
  const explicit = useRef(isTheme(readStorage(KEY)));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    // SEO must not overwrite the user's browser-UI theme on each navigation.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?? Object.assign(document.createElement("meta"), { name: "theme-color" });
    if (!meta.isConnected) document.head.appendChild(meta);
    meta.content = theme === "dark" ? "#121110" : "#faf8f4";
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!explicit.current) setValue(e.matches ? "dark" : "light");
    };
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, []);

  const setTheme = (value: Theme) => {
    explicit.current = true;
    writeStorage(KEY, value);
    setValue(value);
  };

  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
