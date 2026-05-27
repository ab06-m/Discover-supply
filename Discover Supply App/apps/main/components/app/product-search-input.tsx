"use client";

import { useRef, useState, useEffect, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Barcode, Search, X } from "lucide-react";
import { BarcodeScanner } from "@/modules/inventory/components/barcode-scanner";
import { lookupByBarcode } from "@/modules/inventory/actions";

type Suggestion = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
};

export function ProductSearchInput({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const deferredValue = useDeferredValue(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scanMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const query = deferredValue.trim();

    if (query.length < 1) {
      abortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/products/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setActiveIndex(-1);

        const first = data[0];
        if (first) router.prefetch(`/products/${first.id}`);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 80);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [deferredValue, router]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const s = suggestions[activeIndex];
      if (s) navigateTo(s.id);
    }
  }

  function navigateTo(id: string) {
    setOpen(false);
    router.push(`/products/${id}`);
  }

  function clearSearch() {
    setValue("");
    setSuggestions([]);
    setOpen(false);
    router.push("/products");
  }

  function flashScanMessage(text: string) {
    setScanMessage(text);
    if (scanMessageTimerRef.current) clearTimeout(scanMessageTimerRef.current);
    scanMessageTimerRef.current = setTimeout(() => setScanMessage(null), 3000);
  }

  useEffect(() => {
    return () => {
      if (scanMessageTimerRef.current) clearTimeout(scanMessageTimerRef.current);
    };
  }, []);

  async function handleScan(code: string) {
    setScanOpen(false);
    setScanMessage(null);
    try {
      const product = await lookupByBarcode(code);
      if (!product) {
        setValue(code);
        flashScanMessage(`No product found for ${code}.`);
        return;
      }
      router.push(`/products/${product.id}`);
    } catch {
      flashScanMessage("Scan failed. Please try again.");
    }
  }

  return (
    <div ref={containerRef} className="relative max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          className={value ? "pl-8 pr-16" : "pl-8 pr-9"}
          placeholder="Search name, SKU, or barcode…"
          value={value}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setScanMessage(null);
            setScanOpen(true);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Scan barcode to locate item"
          title="Scan barcode to locate item"
        >
          <Barcode className="h-4 w-4" />
        </button>
      </div>

      {scanMessage && (
        <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
          {scanMessage}
        </p>
      )}

      <BarcodeScanner
        open={scanOpen}
        onScan={handleScan}
        onClose={() => setScanOpen(false)}
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-sm transition-colors ${
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onMouseEnter={() => {
                setActiveIndex(i);
                router.prefetch(`/products/${s.id}`);
              }}
              onMouseDown={(e) => { e.preventDefault(); navigateTo(s.id); }}
            >
              <span className="font-medium">{s.name}</span>
              {(s.sku || s.barcode) && (
                <span className="text-xs text-muted-foreground">
                  {[s.sku && `SKU: ${s.sku}`, s.barcode && `#${s.barcode}`].filter(Boolean).join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
