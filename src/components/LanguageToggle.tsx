import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { readStorage, writeStorage } from "@/lib/storage";
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
// NOTE: deliberately not a /g regex — a global regex is stateful across
// .test() calls (lastIndex), which silently skipped every other text node.
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const ORIGINAL_TEXT = new Map<Text, string>();

interface GoogleTranslateAPI {
  TranslateElement?: new (options: unknown, elementId: string) => void;
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

function loadTranslateWidget() {
  if (document.querySelector("select.goog-te-combo")) return;
  let container = document.getElementById("google_translate_element");
  if (!container) {
    container = document.createElement("div");
    container.id = "google_translate_element";
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);
  }
  const init = () => {
    const TranslateElement = window.google?.translate?.TranslateElement || window.google?.TranslateElement;
    try {
      if (TranslateElement && !document.querySelector("select.goog-te-combo")) {
        new TranslateElement({ pageLanguage: "en", includedLanguages: "en,hi,ne,ur,bn", autoDisplay: false }, "google_translate_element");
      }
    } catch (cause) {
      const script = document.getElementById("google-translate-script");
      if (script) script.dataset.failed = "true";
      console.warn("[translation] Widget unavailable:", cause);
    }
  };
  if (window.google?.translate?.TranslateElement || window.google?.TranslateElement) {
    init();
    return;
  }
  const old = document.getElementById("google-translate-script");
  if (old?.dataset.failed === "true") old.remove();
  if (document.getElementById("google-translate-script")) return;
  window.googleTranslateElementInit = init;
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  script.onerror = () => { script.dataset.failed = "true"; };
  document.body.appendChild(script);
}

function waitForCombo(lang: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(ok);
    };
    const abort = () => finish(false);
    const tick = () => {
      if (signal.aborted || document.getElementById("google-translate-script")?.dataset.failed === "true") return finish(false);
      const select = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
      if (select && Array.from(select.options).some(option => option.value === lang)) {
        select.value = lang;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        finish(true);
      } else if (++tries < 32) {
        timer = setTimeout(tick, 250);
      } else finish(false);
    };
    signal.addEventListener("abort", abort, { once: true });
    tick();
  });
}

const pageText = () => Array.from(document.querySelectorAll("main h1, main p, footer p"))
  .map(element => element.textContent || "").join(" ");

// A widget accepting a change is NOT proof that its translation service worked.
// Wait for translated page text before changing the document's language/selection.
function waitForTranslatedText(code: string, before: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    const scripts: Record<string, RegExp> = { hi: /[\u0900-\u097f]/, ne: /[\u0900-\u097f]/, ur: /[\u0600-\u06ff]/, bn: /[\u0980-\u09ff]/ };
    const timer = setTimeout(() => finish(false), 6000);
    const finish = (ok: boolean) => { observer.disconnect(); clearTimeout(timer); signal.removeEventListener("abort", abort); resolve(ok); };
    const check = () => {
      const text = pageText();
      if (text !== before && (code === "en" || scripts[code]?.test(text))) finish(true);
    };
    const observer = new MutationObserver(check);
    const abort = () => finish(false);
    if (signal.aborted) return finish(false);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

function restoreOriginalText() {
  ORIGINAL_TEXT.forEach((text, node) => {
    if (node.isConnected && node.textContent !== text) node.textContent = text;
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

  // Single Devanagari code points (U+0900–U+097F). Conjuncts are matched
  // first so "क्ष" maps to "ksh" rather than three separate letters.
  return text.replace(/क्ष|ज्ञ|त्र|श्र|[\u0900-\u097F]/g, (match) => {
    return map[match] ?? match;
  });
}

function applyHinglishTransliteration() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const value = textNode.textContent || "";
    if (DEVANAGARI_REGEX.test(value) && !textNode.parentElement?.closest("script, style, textarea, .notranslate")) {
      if (!ORIGINAL_TEXT.has(textNode)) {
        ORIGINAL_TEXT.set(textNode, value);
      }
      textNode.textContent = transliterateHinglish(value);
    }
    node = walker.nextNode();
  }
}

export function LanguageToggle() {
  const [current, setCurrent] = useState("en");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const currentRef = useRef("en");
  const requestRef = useRef<AbortController>();

  const switchTo = useCallback(async (code: string) => {
    const selected = LANGUAGES.find(language => language.code === code);
    if (!selected) return;
    // Returning to the original language must work even if the translation CDN is down.
    if (code === "en") {
      requestRef.current?.abort();
      writeStorage(STORAGE_KEY, "en");
      if (currentRef.current !== "en" || document.documentElement.classList.contains("translated-ltr") || document.documentElement.classList.contains("translated-rtl")) {
        for (const domain of ["", `;domain=${window.location.hostname}`, `;domain=.${window.location.hostname}`]) {
          document.cookie = `googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domain}`;
        }
        window.location.reload();
      }
      setPending(false);
      setStatus("English original text selected.");
      return;
    }
    if (code === currentRef.current) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setStatus(`Requesting automatic translation to ${selected.label}…`);
    try {
      const previous = currentRef.current;
      const sameHindiText = ["hi", HINGLISH_CODE].includes(previous) && ["hi", HINGLISH_CODE].includes(code);
      if (previous === HINGLISH_CODE) restoreOriginalText();
      if (!sameHindiText) {
        const before = pageText();
        loadTranslateWidget();
        const accepted = await waitForCombo(selected.translateCode || selected.code, controller.signal);
        if (controller.signal.aborted) return;
        if (!accepted || !await waitForTranslatedText(selected.translateCode || code, before, controller.signal)) {
          if (!controller.signal.aborted) {
            const message = "Automatic translation is unavailable. Please try again later.";
            setStatus(message);
            toast.error(message);
          }
          return;
        }
      }
      if (controller.signal.aborted) return;
      if (code === HINGLISH_CODE) applyHinglishTransliteration();
      currentRef.current = code;
      setCurrent(code);
      document.documentElement.lang = code === HINGLISH_CODE ? "hi-Latn" : code;
      document.documentElement.dir = code === "ur" ? "rtl" : "ltr";
      writeStorage(STORAGE_KEY, code);
      setStatus(`${selected.label} automatic translation applied. Translations may contain errors.`);
    } catch {
      const message = "Automatic translation is unavailable. Please try again later.";
      setStatus(message);
      toast.error(message);
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    const saved = readStorage(STORAGE_KEY);
    // Load the third-party widget only after a language choice, never for every English reader.
    if (saved && saved !== "en" && LANGUAGES.some(language => language.code === saved)) void switchTo(saved);
    return () => { requestRef.current?.abort(); ORIGINAL_TEXT.clear(); };
  }, [switchTo]);

  const label = LANGUAGES.find(language => language.code === current)?.label || "English";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-3 text-headline hover:text-primary notranslate" aria-label={`${label} — Change language`} aria-busy={pending}>
            <Languages className="size-4" />
            <span className="hidden sm:inline text-sm font-medium">{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 notranslate">
          <DropdownMenuLabel>{pending ? "Translating…" : "Select language"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LANGUAGES.map(language => (
            <DropdownMenuItem key={language.code} onClick={() => void switchTo(language.code)} disabled={pending && language.code !== "en"} className="cursor-pointer flex items-center justify-between">
              <span>{language.label}</span>{current === language.code && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" className="sr-only notranslate">{status}</span>
    </>
  );
}
