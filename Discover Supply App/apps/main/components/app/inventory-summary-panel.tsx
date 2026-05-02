"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryItem = {
  label: string;
  value: string;
  tone?: "warning" | "destructive";
};

type Props = {
  items: SummaryItem[];
};

const STORAGE_KEY = "products.inventorySummary.visible";

export function InventorySummaryPanel({ items }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "false");
  }, []);

  function toggleVisible() {
    setVisible((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleVisible}
          title="Show inventory summary"
          aria-label="Show inventory summary"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Eye className="h-4 w-4" />
          <span>Inventory Summary</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 pr-12 shadow-sm sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
      <button
        type="button"
        onClick={toggleVisible}
        title="Hide inventory summary"
        aria-label="Hide inventory summary"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <EyeOff className="h-4 w-4" />
      </button>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="break-words text-sm font-semibold tabular-nums text-foreground sm:text-base">
            {item.value}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {item.tone ? (
              <span
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  item.tone === "warning" ? "bg-warning" : "bg-destructive",
                )}
              />
            ) : null}
            <span className="min-w-0">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
