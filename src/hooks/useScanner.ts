import { useEffect, useRef } from "react";

interface UseScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useScanner({ onScan, enabled = true }: UseScannerOptions) {
  const bufferRef = useRef<string[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
        return;
      }

      // Check if user is typing in a standard input field
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isInput = tagName === "input" || tagName === "textarea" || activeEl.getAttribute("contenteditable") === "true";
        
        // We only bypass if the input is explicitly marked as "scanner-friendly"
        // (like our barcode manual inputs)
        const isScannerFriendly = activeEl.classList.contains("scanner-target") || activeEl.id === "barcode-input";
        
        if (isInput && !isScannerFriendly) {
          // Reset buffer since the user is manually typing elsewhere
          bufferRef.current = [];
          return;
        }
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Hardware barcode scanners type extremely fast (typically < 30ms per character)
      // We set a threshold of 50ms. If it's slower, it might be manual typing.
      if (timeDiff > 50 && bufferRef.current.length > 0) {
        // Clear buffer if it's too slow, meaning it was a manual keypress
        bufferRef.current = [];
      }

      if (e.key === "Enter") {
        if (bufferRef.current.length >= 3) {
          const barcode = bufferRef.current.join("").trim();
          onScan(barcode);
          e.preventDefault();
        }
        bufferRef.current = [];
      } else {
        // Only collect alphanumeric keys/symbols of length 1
        if (e.key.length === 1) {
          bufferRef.current.push(e.key);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onScan, enabled]);
}
