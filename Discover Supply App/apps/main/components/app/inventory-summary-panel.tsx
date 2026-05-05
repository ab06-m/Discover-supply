"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SummaryItem = {
  id: string;
  label: string;
  value: string;
  tone?: "warning" | "destructive";
};

type Props = {
  items: SummaryItem[];
};

const LEGACY_VISIBLE_STORAGE_KEY = "products.inventorySummary.visible";
const STORAGE_KEY = "products.inventorySummary.config.v1";

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sanitizeItemOrder(value: unknown, ids: string[]) {
  if (!Array.isArray(value)) return ids;
  const valid = value.filter((id): id is string => typeof id === "string" && ids.includes(id));
  return [...valid, ...ids.filter((id) => !valid.includes(id))];
}

function sanitizeVisibleItems(value: unknown, ids: string[]) {
  if (!Array.isArray(value)) return new Set(ids);
  const valid = value.filter((id): id is string => typeof id === "string" && ids.includes(id));
  return new Set(valid);
}

export function InventorySummaryPanel({ items }: Props) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [itemOrder, setItemOrder] = useState<string[]>(itemIds);
  const [visibleItemIds, setVisibleItemIds] = useState<Set<string>>(() => new Set(itemIds));
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const legacyVisible = window.localStorage.getItem(LEGACY_VISIBLE_STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as {
          order?: unknown;
          visible?: unknown;
          summaryVisible?: unknown;
        };
        setItemOrder(sanitizeItemOrder(parsed.order, itemIds));
        setVisibleItemIds(sanitizeVisibleItems(parsed.visible, itemIds));
        setSummaryVisible(
          typeof parsed.summaryVisible === "boolean"
            ? parsed.summaryVisible
            : legacyVisible !== "false",
        );
      } else {
        setItemOrder(itemIds);
        setVisibleItemIds(new Set(itemIds));
        setSummaryVisible(legacyVisible !== "false");
      }
    } catch {
      setItemOrder(itemIds);
      setVisibleItemIds(new Set(itemIds));
      setSummaryVisible(true);
    } finally {
      setStorageLoaded(true);
    }
  }, [itemIds]);

  useEffect(() => {
    if (!storageLoaded) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        order: itemOrder,
        visible: Array.from(visibleItemIds),
        summaryVisible,
      }),
    );
    window.localStorage.setItem(LEGACY_VISIBLE_STORAGE_KEY, String(summaryVisible));
  }, [itemOrder, storageLoaded, summaryVisible, visibleItemIds]);

  const orderedItems = itemOrder
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is SummaryItem => Boolean(item));
  const activeItems = orderedItems.filter((item) => visibleItemIds.has(item.id));

  function toggleVisible() {
    setSummaryVisible((current) => !current);
  }

  function toggleItem(id: string) {
    setVisibleItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetItems() {
    setItemOrder(itemIds);
    setVisibleItemIds(new Set(itemIds));
  }

  function moveSummaryItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= itemOrder.length) return;
    setItemOrder((current) => moveItem(current, index, nextIndex));
  }

  if (!summaryVisible) {
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
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              title="Configure inventory summary"
              aria-label="Configure inventory summary"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-card px-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Columns3 className="h-4 w-4" />
              <span>Columns</span>
            </button>
          </DialogTrigger>
          <DialogContent title="Edit inventory summary" className="max-w-md">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Show and reorder stats
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetItems}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {orderedItems.map((item, index) => {
                const isVisible = visibleItemIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
                      isVisible ? "bg-card" : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <label className="flex min-w-0 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleItem(item.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="truncate">{item.label}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move up"
                        aria-label={`Move ${item.label} up`}
                        disabled={index === 0}
                        onClick={() => moveSummaryItem(index, -1)}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move down"
                        aria-label={`Move ${item.label} down`}
                        disabled={index === orderedItems.length - 1}
                        onClick={() => moveSummaryItem(index, 1)}
                        className="h-8 w-8"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
        <button
          type="button"
          onClick={toggleVisible}
          title="Hide inventory summary"
          aria-label="Hide inventory summary"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 shadow-sm">
        {activeItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 xl:grid-cols-6">
            {activeItems.map((item) => (
              <div key={item.id} className="min-w-0">
                <div className="truncate text-sm font-semibold tabular-nums text-foreground sm:text-base">
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
                  <span className="min-w-0 truncate">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-16 items-center text-sm text-muted-foreground">
            <span>No visible stats</span>
          </div>
        )}
      </div>
    </div>
  );
}
