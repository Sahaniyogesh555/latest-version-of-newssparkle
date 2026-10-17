import { useCallback, useEffect, useRef, useState } from "react";

export function useClipboard(text: string) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setCopied(false);
    setCopyFailed(false);
    return () => clearTimeout(timer.current);
  }, [text]);

  const copy = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      setCopied(false);
      setCopyFailed(true);
      return false;
    }
  }, [text]);

  return { copied, copyFailed, copy };
}
