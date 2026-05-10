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

const HINGLISH_CODE = "hi-roman";

const LANGUAGES: { label: string; code: string; translateCode?: string }[] = [
  { label: "English", code: "en" },
  { label: "Hinglish", code: HINGLISH_CODE, translateCode: "hi" },
  { label: "Hindi", code: "hi" },
  { label: "Nepali", code: "ne" },
  { label: "Urdu", code: "ur" },
  { label: "Bengali", code: "bn" },
];

const STORAGE_KEY = "preferred_lang";
const DEVANAGARI_REGEX = /[\u0900-\u097F]+/g;
const ORIGINAL_TEXT = new Map<Text, string>();

interface GoogleTranslateAPI {
  translate?: {
    Service?: {
      LayoutDirection?: {
        setLang?: (lang: string) => void;
      };
      TranslateElement?: new (options: unknown, elementId: string) => void;
    };
    TranslateElement?: new (options: unknown, elementId: string) => void;
  };
}

declare global {
  interface Window {
    google?: GoogleTranslateAPI;
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

function waitForCombo(lang: string, attempts = 40): Promise<void> {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      if (triggerTranslate(lang)) {
        resolve();
        return;
      }
      if (++tries < attempts) {
        setTimeout(tick, 250);
      } else {
        resolve();
      }
    };
    tick();
  });
}

function captureOriginalText(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent && node.textContent.trim()) {
      ORIGINAL_TEXT.set(node as Text, node.textContent);
    }
    node = walker.nextNode();
  }
}

function restoreOriginalText() {
  ORIGINAL_TEXT.forEach((text, node) => {
    if (node.textContent !== text) node.textContent = text;
  });
  ORIGINAL_TEXT.clear();
}

function transliterateHinglish(text: string) {
  const map: Record<string, string> = {
    "क्ष": "ksh",
    "ज्ञ": "gy",
    "त्र": "tr",
    "श्र": "shr",
    "क": "k",
    "ख": "kh",
    "ग": "g",
    "घ": "gh",
    "ङ": "ng",
    "च": "ch",
    "छ": "chh",
    "ज": "j",
    "झ": "jh",
    "ञ": "ny",
    "ट": "t",
    "ठ": "th",
    "ड": "d",
    "ढ": "dh",
    "ण": "n",
    "त": "t",
    "थ": "th",
    "द": "d",
    "ध": "dh",
    "न": "n",
    "प": "p",
    "फ": "ph",
    "ब": "b",
    "भ": "bh",
    "म": "m",
    "य": "y",
    "र": "r",
    "ल": "l",
    "व": "v",
    "श": "sh",
    "ष": "sh",
    "स": "s",
    "ह": "h",
    "अ": "a",
    "आ": "aa",
    "इ": "i",
    "ई": "ee",
    "उ": "u",
    "ऊ": "oo",
    "ए": "e",
    "ऐ": "ai",
    "ओ": "o",
    "औ": "au",
    "ा": "a",
    "ि": "i",
    "ी": "ee",
    "ु": "u",
    "ू": "oo",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
    "ं": "n",
    "ः": "h",
    "ँ": "n",
    "़": "",
    "्": "",
  };

  return text.replace(/क्ष|ज्ञ|त्र|श्र|[क-हअ-औािीुूेैोौंःँ़्]/g, (match) => {
    return map[match] ?? match;
  });
}

function applyHinglishTransliteration() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const value = textNode.textContent || "";
    if (DEVANAGARI_REGEX.test(value)) {
      if (!ORIGINAL_TEXT.has(textNode)) {
        ORIGINAL_TEXT.set(textNode, value);
      }
      textNode.textContent = transliterateHinglish(value);
    }
    node = walker.nextNode();
  }
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

    const initAndApply = async () => {
      try {
        const TranslateElement = window.google?.translate?.TranslateElement || window.google?.TranslateElement;
        if (TranslateElement) {
          new TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,hi,ne,ur,bn",
              autoDisplay: false,
            },
            "google_translate_element",
          );
        }
      } catch (e) {
        console.error("Google Translate init failed", e);
      }

      captureOriginalText(document.body);
      const activeLanguage = LANGUAGES.find((l) => l.code === saved);
      const target = activeLanguage?.translateCode || activeLanguage?.code || "en";
      if (saved !== "en") {
        await waitForCombo(target);
        if (saved === HINGLISH_CODE) {
          setTimeout(applyHinglishTransliteration, 500);
        }
      }
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
    } else {
      initAndApply();
    }
  }, []);

  const switchTo = async (code: string) => {
    const selected = LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
    localStorage.setItem(STORAGE_KEY, code);
    setCurrent(code);

    if (code !== HINGLISH_CODE && ORIGINAL_TEXT.size > 0) {
      restoreOriginalText();
    }

    const target = selected.translateCode || selected.code;
    await waitForCombo(target);

    if (code === HINGLISH_CODE) {
      setTimeout(applyHinglishTransliteration, 500);
    }
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
            {LANGUAGES.find((l) => l.code === current)?.label ?? "Language"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 notranslate">
        <DropdownMenuLabel>Select language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
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
