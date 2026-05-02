"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ImageIcon, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import {
  BarcodeScanner,
  BarcodeScanButton,
} from "@/modules/inventory/components/barcode-scanner";
import { lookupByBarcode } from "@/modules/inventory/actions";
import {
  browseOrderProducts,
  createOrder,
  searchOrderProducts,
} from "../actions";
import { cn, formatMoney } from "@/lib/utils";

type CustomerOption = { id: string; name: string; storeCode: string | null };

type StageOption = { id: string; name: string; color: string; slug: string };

type Line = {
  key: string;
  productId?: string;
  name: string;
  sku: string | null;
  imageUrl?: string | null;
  // `quantity` is the number entered against `unitOfMeasure`. The base-unit
  // count actually committed against stock is `quantity * packSize` when the
  // user sells by Case, else `quantity`.
  quantity: number;
  unitOfMeasure: "each" | "box";
  packSize: number;
  unitPrice: number;
  // Per-each price captured when the line was added — used to auto-derive the
  // displayed `unitPrice` when the user toggles between Unit and Case, unless
  // they've manually edited the price (then we leave it alone).
  defaultUnitPriceEach: number;
  unitPriceTouched: boolean;
  discount: number;
  taxRate: number;
  onHand?: number;
  committed?: number;
  expanded?: boolean;
};

type ProductHit = {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  unit?: string | null;
  packSize?: number | null;
  imageUrl?: string | null;
  price: string | number;
  onHand: number;
  committed: number;
};

const BOX_UNITS: ReadonlySet<string> = new Set(["box", "case", "pack"]);
function defaultUomFor(p: Pick<ProductHit, "unit" | "packSize">): "each" | "box" {
  if ((p.packSize ?? 1) > 1 && BOX_UNITS.has(p.unit ?? "")) return "box";
  return "each";
}

type Props = {
  customers: CustomerOption[];
  currency: string;
  defaultTaxRate?: number;
  preselectedCustomerId?: string;
  stages?: StageOption[];
  initialStageId?: string | null;
  lowStockThreshold?: number;
};

function stockStatus(p: { onHand: number; committed: number }, threshold: number) {
  const available = p.onHand - p.committed;
  if (available <= 0) return { tone: "out" as const, available };
  if (available <= threshold) return { tone: "low" as const, available };
  return { tone: "ok" as const, available };
}

function stockText(p: { onHand: number; committed: number }, threshold: number, unit?: string | null) {
  const { tone, available } = stockStatus(p, threshold);
  const u = unit || "Pcs";
  if (tone === "out") return { text: `Out of stock: 0 ${u}`, className: "text-destructive" };
  if (tone === "low") return { text: `Low stock: ${available} ${u}`, className: "text-warning" };
  return { text: `In stock: ${available} ${u}`, className: "text-muted-foreground" };
}

export function OrderForm({
  customers,
  currency,
  defaultTaxRate = 0,
  preselectedCustomerId,
  stages = [],
  initialStageId = null,
  lowStockThreshold = 5,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState<string>(preselectedCustomerId ?? "");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [stageId, setStageId] = useState<string>(initialStageId ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    for (const l of lines) {
      const gross = l.unitPrice * l.quantity;
      const afterDisc = Math.max(0, gross - l.discount);
      subtotal += gross;
      discount += l.discount;
      tax += afterDisc * l.taxRate;
    }
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  // Close suggestions on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function addHit(p: ProductHit) {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id);
      if (existing) {
        return ls.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      const priceEach = parseFloat(String(p.price)) || 0;
      const packSize = Math.max(1, p.packSize ?? 1);
      const uom = defaultUomFor(p);
      return [
        ...ls,
        {
          key: crypto.randomUUID(),
          productId: p.id,
          name: p.name,
          sku: p.sku,
          imageUrl: p.imageUrl ?? null,
          quantity: 1,
          unitOfMeasure: uom,
          packSize,
          // Displayed price tracks the chosen unit: per-case when cased,
          // per-unit when not. The unit price is preserved separately so
          // toggling units stays consistent.
          unitPrice: uom === "box" ? priceEach * packSize : priceEach,
          defaultUnitPriceEach: priceEach,
          unitPriceTouched: false,
          discount: 0,
          taxRate: defaultTaxRate,
          onHand: p.onHand,
          committed: p.committed,
        },
      ];
    });
    setQuery("");
    setResults([]);
    setSearchOpen(false);
  }

  async function runSearch(q: string) {
    setQuery(q);
    setSearchOpen(true);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchOrderProducts(q);
      setResults(hits as ProductHit[]);
    } finally {
      setSearching(false);
    }
  }

  async function handleScan(code: string) {
    setScanMessage(null);
    const p = await lookupByBarcode(code);
    if (p) {
      addHit({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        packSize: p.packSize,
        imageUrl: p.imageUrl,
        price: p.price,
        onHand: p.onHand,
        committed: p.committed,
      });
      setScanMessage(`Added: ${p.name}`);
    } else {
      setScanMessage(`No product found for ${code}.`);
    }
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  // The user typed in the price field — flag the line so we don't overwrite
  // their value when they toggle Unit/Case afterwards.
  function updatePrice(key: string, price: number) {
    setLines((ls) =>
      ls.map((l) => (l.key === key ? { ...l, unitPrice: price, unitPriceTouched: true } : l)),
    );
  }
  function changeUnit(key: string, uom: "each" | "box") {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const packSize = uom === "box" ? Math.max(1, l.packSize || 1) : 1;
        // Auto-derive the displayed price unless the user has overridden it.
        const unitPrice = l.unitPriceTouched
          ? l.unitPrice
          : uom === "box"
            ? l.defaultUnitPriceEach * packSize
            : l.defaultUnitPriceEach;
        return { ...l, unitOfMeasure: uom, packSize, unitPrice };
      }),
    );
  }
  function changePackSize(key: string, size: number) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const packSize = Math.max(1, size || 1);
        const unitPrice =
          l.unitPriceTouched || l.unitOfMeasure !== "box"
            ? l.unitPrice
            : l.defaultUnitPriceEach * packSize;
        return { ...l, packSize, unitPrice };
      }),
    );
  }
  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }
  function toggleExpanded(key: string) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, expanded: !l.expanded } : l)));
  }
  function addBlankLine() {
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        name: "",
        sku: null,
        quantity: 1,
        unitOfMeasure: "each",
        packSize: 1,
        unitPrice: 0,
        defaultUnitPriceEach: 0,
        unitPriceTouched: false,
        discount: 0,
        taxRate: defaultTaxRate,
      },
    ]);
  }

  const filteredResults = useMemo(() => {
    if (!onlyAvailable) return results;
    return results.filter((r) => r.onHand - r.committed > 0);
  }, [results, onlyAvailable]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    if (lines.some((l) => !l.name.trim())) {
      setError("Every line needs a product name.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createOrder({
          customerId: customerId || undefined,
          notes: notes || undefined,
          internalNotes: internalNotes || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            sku: l.sku || undefined,
            quantity: l.quantity,
            unitOfMeasure: l.unitOfMeasure,
            packSize: l.packSize,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
          })),
        });
        router.push(`/orders/${res.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  }

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name, color: s.color }));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        backHref="/orders"
        backLabel="Back to orders"
        title="Create new order"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || lines.length === 0}>
              {isPending ? "Saving…" : "Create order"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Order detail card */}
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-base font-semibold">Order detail</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customerId">Customer</Label>
                  <Select
                    id="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Walk-in customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.storeCode ? `${c.storeCode} · ` : ""}
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warehouse">From warehouse</Label>
                  {/* TODO: wire to warehouses when multi-warehouse ships */}
                  <Select id="warehouse" defaultValue="main">
                    <option value="main">Main stock</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricelist">Pricelist</Label>
                  {/* TODO: wire to pricelists when pricelist feature ships */}
                  <Select id="pricelist" defaultValue="retail">
                    <option value="retail">{currency} - Retail price</option>
                  </Select>
                </div>
              </div>
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  More information
                </summary>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="internalNotes">Internal notes (not shown to customer)</Label>
                  <Textarea
                    id="internalNotes"
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="PO references, delivery instructions, internal context…"
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Items card */}
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <div ref={searchRef} className="relative flex-1 min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Type to add product"
                    value={query}
                    onChange={(e) => runSearch(e.target.value)}
                    onFocus={() => query.length >= 2 && setSearchOpen(true)}
                  />
                  {searchOpen && (query.length >= 2 || results.length > 0) && (
                    <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-card-hover">
                      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                        <Link
                          href="/products/new"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Plus className="h-4 w-4" /> Create product
                        </Link>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={onlyAvailable}
                            onChange={(e) => setOnlyAvailable(e.target.checked)}
                          />
                          Only available
                        </label>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        {searching && (
                          <div className="px-3 py-3 text-sm text-muted-foreground">Searching…</div>
                        )}
                        {!searching && filteredResults.length === 0 && (
                          <div className="px-3 py-3 text-sm text-muted-foreground">
                            No products match.
                          </div>
                        )}
                        {filteredResults.map((p) => {
                          const status = stockText(p, lowStockThreshold, p.unit ?? null);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => addHit(p)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {p.name}
                                  {(p.packSize ?? 1) > 1 && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      · case of {p.packSize}
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {p.barcode ? `Barcode: ${p.barcode}` : p.sku ? `SKU: ${p.sku}` : "—"}
                                </div>
                              </div>
                              <div className={cn("shrink-0 text-right text-xs font-medium", status.className)}>
                                {p.onHand - p.committed} {p.unit || "Pcs"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" onClick={() => setBrowseOpen(true)}>
                  Browse products
                </Button>
                <BarcodeScanButton onClick={() => setScanOpen(true)} />
              </div>
              {scanMessage && (
                <p className="text-sm text-muted-foreground">{scanMessage}</p>
              )}

              {lines.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  No items yet. Search a product, scan a barcode, or{" "}
                  <button type="button" onClick={addBlankLine} className="text-primary underline">
                    add a custom line
                  </button>
                  .
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="hidden bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_120px_120px_120px_36px] sm:items-center sm:gap-3">
                    <div>Product</div>
                    <div>Price</div>
                    <div>Quantity</div>
                    <div>Sell as</div>
                    <div className="text-right">Total</div>
                    <div />
                  </div>
                  <div className="divide-y">
                    {lines.map((l) => {
                      const gross = l.unitPrice * l.quantity;
                      const afterDisc = Math.max(0, gross - l.discount);
                      const lineTotal = afterDisc + afterDisc * l.taxRate;
                      const isBox = l.unitOfMeasure === "box";
                      const baseQty = isBox ? l.quantity * l.packSize : l.quantity;
                      const available =
                        l.onHand !== undefined && l.committed !== undefined
                          ? l.onHand - l.committed
                          : null;
                      const overSold = available !== null && baseQty > available;
                      const status =
                        l.onHand !== undefined && l.committed !== undefined
                          ? stockText({ onHand: l.onHand, committed: l.committed }, lowStockThreshold)
                          : null;
                      // The trailing case tag (e.g. "case of 12") staff have been
                      // typing into product names. Now the form appends it
                      // automatically when the line is sold by the case.
                      const nameSuffix = isBox && l.packSize > 1 ? ` · case of ${l.packSize}` : "";
                      return (
                        <div key={l.key}>
                          <div className="flex flex-col gap-3 p-3 sm:grid sm:grid-cols-[1fr_140px_120px_120px_120px_36px] sm:items-center sm:gap-3 sm:p-3">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(l.key)}
                                className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                                aria-label="Expand"
                              >
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    l.expanded && "rotate-90",
                                  )}
                                />
                              </button>
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                                {l.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={l.imageUrl}
                                    alt=""
                                    className="h-full w-full rounded-md object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-1">
                                  <Input
                                    className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                    value={l.name}
                                    onChange={(e) => updateLine(l.key, { name: e.target.value })}
                                    placeholder="Item name"
                                  />
                                  {nameSuffix && (
                                    <span
                                      className="text-xs font-medium text-muted-foreground"
                                      title={`Case of ${l.packSize}`}
                                    >
                                      {nameSuffix}
                                    </span>
                                  )}
                                </div>
                                {overSold ? (
                                  <div className="text-xs font-medium text-destructive">
                                    Exceeds available ({available} each)
                                  </div>
                                ) : status ? (
                                  <div className={cn("text-xs", status.className)}>{status.text}</div>
                                ) : l.sku ? (
                                  <div className="text-xs text-muted-foreground">{l.sku}</div>
                                ) : null}
                                {isBox && (
                                  <div className="text-xs text-muted-foreground">
                                    {l.quantity.toLocaleString()} case
                                    {l.quantity === 1 ? "" : "s"} x{" "}
                                    {l.packSize.toLocaleString()} units ={" "}
                                    {baseQty.toLocaleString()} units from stock
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={l.unitPrice}
                                onChange={(e) =>
                                  updatePrice(l.key, parseFloat(e.target.value || "0"))
                                }
                                className="pr-12"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                {currency}
                              </span>
                            </div>
                            <Input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  quantity: parseInt(e.target.value || "0", 10),
                                })
                              }
                            />
                            <div className="flex flex-col gap-1">
                              <Select
                                value={l.unitOfMeasure}
                                onChange={(e) =>
                                  changeUnit(l.key, e.target.value as "each" | "box")
                                }
                              >
                                <option value="each">Unit</option>
                                <option value="box">Case</option>
                              </Select>
                              {isBox && (
                                <Input
                                  type="number"
                                  min={1}
                                  value={l.packSize}
                                  onChange={(e) =>
                                    changePackSize(l.key, parseInt(e.target.value || "1", 10))
                                  }
                                  aria-label="Units per case"
                                  title="Units per case"
                                  className="h-8 text-xs"
                                />
                              )}
                            </div>
                            <div className="text-right text-sm font-semibold tabular-nums">
                              {formatMoney(lineTotal, currency)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {l.expanded && (
                            <div className="grid gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor={`disc-${l.key}`} className="text-xs">
                                  Discount
                                </Label>
                                <Input
                                  id={`disc-${l.key}`}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={l.discount}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      discount: parseFloat(e.target.value || "0"),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`tax-${l.key}`} className="text-xs">
                                  Tax rate (%)
                                </Label>
                                <Input
                                  id={`tax-${l.key}`}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={l.taxRate * 100}
                                  onChange={(e) =>
                                    updateLine(l.key, {
                                      taxRate: (parseFloat(e.target.value || "0") || 0) / 100,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {lines.length > 0 && (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={addBlankLine}>
                    + Add custom line
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes card */}
          <Card className="shadow-card">
            <CardContent className="space-y-2 p-6">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type here…"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sticky right rail */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="text-primary hover:underline">
                  Discount (+/−)
                </button>
                <span className="tabular-nums">{formatMoney(totals.discount, currency)}</span>
              </div>
              {totals.tax > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
              </div>
            </CardContent>
          </Card>

          {stages.length > 0 && (
            <Card className="shadow-card">
              <CardContent className="space-y-2 p-6">
                <Label>Status</Label>
                <StatusPill
                  name="stage"
                  options={stageOptions}
                  value={stageId}
                  onChange={setStageId}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isPending || lines.length === 0} className="w-full">
              {isPending ? "Saving…" : "Create order"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <BarcodeScanner
        open={scanOpen}
        continuous
        onScan={handleScan}
        onClose={() => setScanOpen(false)}
      />

      <BrowseProductsDialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        currency={currency}
        lowStockThreshold={lowStockThreshold}
        onSelect={(p) => {
          addHit(p);
          setBrowseOpen(false);
        }}
      />
    </form>
  );
}

function BrowseProductsDialog({
  open,
  onClose,
  onSelect,
  currency,
  lowStockThreshold,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (p: ProductHit) => void;
  currency: string;
  lowStockThreshold: number;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(() => {
      browseOrderProducts({ search: search || undefined, limit: 50 })
        .then((rows) => setItems(rows as ProductHit[]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [open, search]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-card-hover">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-semibold">Browse products</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, SKU, or barcode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No products found.</div>
          )}
          {!loading &&
            items.map((p) => {
              const status = stockText(p, lowStockThreshold, p.unit ?? null);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="flex w-full items-center justify-between gap-3 border-b px-4 py-2.5 text-left hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {p.name}
                        {(p.packSize ?? 1) > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · case of {p.packSize}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ?? p.barcode ?? "—"} · {formatMoney(p.price, currency)}
                      </div>
                    </div>
                  </div>
                  <div className={cn("text-xs font-medium", status.className)}>
                    {p.onHand - p.committed} {p.unit || "Pcs"}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
