import { useEffect, useState } from "react";
import { Languages, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LANGUAGES: { label: string; code: string }[] = [
  { label: "English", code: "en" },
  { label: "Hindi", code: "hi" },
  { label: "Nepali", code: "ne" },
  { label: "Urdu", code: "ur" },
  { label: "Bengali", code: "bn" },
];

const STORAGE_KEY = "preferred_lang";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

function triggerTranslate(lang: string): boolean {
  const select = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (!select) return false;
  select.value = lang;
  select.dispatchEvent(new Event("change"));
  return true;
}

function waitForCombo(lang: string, attempts = 40) {
  let tries = 0;
  const tick = () => {
    if (triggerTranslate(lang)) return;
    if (++tries < attempts) setTimeout(tick, 250);
  };
  tick();
}

export function LanguageToggle() {
  const [current, setCurrent] = useState<string>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || "en";
    setCurrent(saved);

    if (!document.getElementById("google_translate_element")) {
      const div = document.createElement("div");
      div.id = "google_translate_element";
      div.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;";
      document.body.appendChild(div);
    }

    const initAndApply = () => {
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: "en,hi,ne,ur,bn",
            autoDisplay: false,
          },
          "google_translate_element",
        );
      } catch (e) {
        console.error("Google Translate init failed", e);
      }
      if (saved && saved !== "en") waitForCombo(saved);
    };

    if (window.google?.translate?.TranslateElement) {
      initAndApply();
    } else if (!document.getElementById("google-translate-script")) {
      window.googleTranslateElementInit = initAndApply;
      const s = document.createElement("script");
      s.id = "google-translate-script";
      s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  const switchTo = (code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setCurrent(code);
    waitForCombo(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-headline hover:text-primary notranslate"
          aria-label="Change language"
        >
          <Languages className="size-4" />
          <span className="hidden sm:inline text-[14px] font-medium">
            {LANGUAGES.find(l => l.code === current)?.label ?? "Language"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 notranslate">
        <DropdownMenuLabel>Select language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => switchTo(l.code)}
            className="cursor-pointer flex items-center justify-between"
          >
            <span>{l.label}</span>
            {current === l.code && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
