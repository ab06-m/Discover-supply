"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { BarcodeScanner, BarcodeScanButton } from "./barcode-scanner";
import { lookupByBarcode, receiveStock } from "../actions";

type ProductUnit =
  | "each"
  | "case"
  | "box"
  | "pack"
  | "kg"
  | "lb"
  | "liter"
  | "gallon"
  | null;

type Line = {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  // How the user entered the qty. `packSize` is the multiplier when
  // unitOfMeasure === "box"; the UI calls this a Case.
  unitOfMeasure: "each" | "box";
  packSize: number;
  onHand: number;
  committed: number;
  currentPrice?: number;
  unitCost?: number;
};

type SearchHit = {
  id: string;
  name: string;
  sku: string | null;
  packSize?: number | null;
  unit?: ProductUnit;
  imageUrl?: string | null;
  price: string;
  cost: string;
  onHand: number;
  committed: number;
};

// Treat products whose configured unit is a multi-pack as defaulting to case
// entry on check-in. Each / kg / liter / etc. default to plain units.
const BOX_UNITS: ReadonlySet<string> = new Set(["box", "case", "pack"]);
function defaultUnitFor(p: Pick<SearchHit, "unit" | "packSize">): "each" | "box" {
  if ((p.packSize ?? 1) > 1 && BOX_UNITS.has(p.unit ?? "")) return "box";
  return "each";
}

function moneyValue(value: string | number | null | undefined) {
  const parsed = parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

type Props = {
  /** Callback to search products — provided by server component so we don't hit an API route */
  searchAction: (query: string) => Promise<SearchHit[]>;
  currency: string;
};

export function ReceiveForm({ searchAction, currency }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [notes, setNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addLine(p: SearchHit) {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id);
      if (existing) {
        return ls.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...ls,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          imageUrl: p.imageUrl ?? null,
          quantity: 1,
          unitOfMeasure: defaultUnitFor(p),
          packSize: Math.max(1, p.packSize ?? 1),
          onHand: p.onHand,
          committed: p.committed,
          currentPrice: moneyValue(p.price),
          unitCost: moneyValue(p.cost),
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchAction(q);
      setSearchResults(hits);
    } finally {
      setSearching(false);
    }
  }

  async function handleScan(code: string) {
    setScanMessage(null);
    const product = await lookupByBarcode(code);
    if (product) {
      if (product.kind !== "goods" || !product.trackStock || !product.isActive) {
        setScanMessage(`${product.name} is not an active inventory-tracked item.`);
        return;
      }
      addLine({
        id: product.id,
        name: product.name,
        sku: product.sku,
        packSize: product.packSize,
        unit: product.unit,
        imageUrl: product.imageUrl,
        price: product.price,
        cost: product.cost,
        onHand: product.onHand,
        committed: product.committed,
      });
      setScanMessage(`Added: ${product.name}`);
    } else {
      setScanMessage(`No product found for barcode ${code}. Add it in Products first.`);
    }
    // stay open for rapid receiving; user closes when done
  }

  function updateQty(productId: string, qty: number) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)));
  }
  function updateCost(productId: string, cost: number | undefined) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, unitCost: cost } : l)));
  }
  function updatePrice(productId: string, price: number | undefined) {
    setLines((ls) =>
      ls.map((l) => (l.productId === productId ? { ...l, currentPrice: price } : l)),
    );
  }
  function updateUnit(productId: string, uom: "each" | "box") {
    setLines((ls) =>
      ls.map((l) => {
        if (l.productId !== productId) return l;
        // Switching to case keeps whatever packSize the product carried; if the
        // user previously zeroed it out, fall back to a sane default of 1.
        const nextPack = uom === "box" ? Math.max(1, l.packSize || 1) : 1;
        return { ...l, unitOfMeasure: uom, packSize: nextPack };
      }),
    );
  }
  function updatePackSize(productId: string, size: number) {
    setLines((ls) =>
      ls.map((l) =>
        l.productId === productId ? { ...l, packSize: Math.max(1, size || 1) } : l,
      ),
    );
  }
  function removeLine(productId: string) {
    setLines((ls) => ls.filter((l) => l.productId !== productId));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await receiveStock({
          supplierName: supplierName || undefined,
          supplierRef: supplierRef || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitOfMeasure: l.unitOfMeasure,
            packSize: l.packSize,
            unitCost: l.unitCost,
            currentPrice: l.currentPrice,
          })),
        });
        router.push(`/products?received=${encodeURIComponent(res.number)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to receive stock");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Add items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search product by name or SKU…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background shadow-md">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span>{p.onHand - p.committed} available</span>
                        <span>{formatMoney(p.price, currency)}</span>
                        {(p.packSize ?? 1) > 1 && <span>case of {p.packSize}</span>}
                        {p.sku && <span>{p.sku}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Searching…
                </span>
              )}
            </div>
            <BarcodeScanButton onClick={() => setScanOpen(true)} />
          </div>
          {scanMessage && <p className="text-sm text-muted-foreground">{scanMessage}</p>}

          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No items yet. Search or scan a barcode to add.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">Product</th>
                    <th className="p-2 w-28">Receive as</th>
                    <th className="p-2 w-24">Units/case</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-32">Sale price</th>
                    <th className="p-2 w-32">Unit cost</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const isBox = l.unitOfMeasure === "box";
                    const baseQty = isBox ? l.quantity * l.packSize : l.quantity;
                    const available = l.onHand - l.committed;
                    const afterOnHand = l.onHand + baseQty;
                    const afterAvailable = available + baseQty;
                    return (
                      <tr key={l.productId} className="border-b align-top">
                        <td className="p-2">
                          <div className="flex items-start gap-2">
                            {l.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={l.imageUrl}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded border bg-muted object-cover"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <div className="font-medium">{l.name}</div>
                              {l.sku && (
                                <div className="text-xs text-muted-foreground">{l.sku}</div>
                              )}
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                On hand: {l.onHand.toLocaleString()} | Committed:{" "}
                                {l.committed.toLocaleString()} | Available:{" "}
                                {available.toLocaleString()}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                Check in: {baseQty.toLocaleString()} units | After:{" "}
                                {afterOnHand.toLocaleString()} on hand /{" "}
                                {afterAvailable.toLocaleString()} available
                              </div>
                              {isBox && (
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {l.quantity.toLocaleString()} case
                                  {l.quantity === 1 ? "" : "s"} x{" "}
                                  {l.packSize.toLocaleString()} units
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <select
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={l.unitOfMeasure}
                            onChange={(e) =>
                              updateUnit(l.productId, e.target.value as "each" | "box")
                            }
                          >
                            <option value="each">Unit</option>
                            <option value="box">Case</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            value={l.packSize}
                            disabled={!isBox}
                            onChange={(e) =>
                              updatePackSize(l.productId, parseInt(e.target.value || "1", 10))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) =>
                              updateQty(l.productId, parseInt(e.target.value || "0", 10))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={l.currentPrice ?? ""}
                            onChange={(e) =>
                              updatePrice(
                                l.productId,
                                e.target.value === "" ? undefined : parseFloat(e.target.value),
                              )
                            }
                          />
                          <div className="mt-1 text-xs text-muted-foreground">
                            Current: {formatMoney(l.currentPrice ?? 0, currency)}
                          </div>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="—"
                            value={l.unitCost ?? ""}
                            onChange={(e) =>
                              updateCost(
                                l.productId,
                                e.target.value === "" ? undefined : parseFloat(e.target.value),
                              )
                            }
                          />
                          <div className="mt-1 text-xs text-muted-foreground">
                            Stock value +{formatMoney((l.unitCost ?? 0) * baseQty, currency)}
                          </div>
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLine(l.productId)}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Receipt details (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier</Label>
            <Input
              id="supplierName"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplierRef">Reference # / PO #</Label>
            <Input
              id="supplierRef"
              value={supplierRef}
              onChange={(e) => setSupplierRef(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || lines.length === 0}>
          {isPending ? "Saving…" : `Receive ${lines.length || ""} item${lines.length === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <BarcodeScanner
        open={scanOpen}
        continuous
        onScan={handleScan}
        onClose={() => setScanOpen(false)}
      />
    </form>
  );
}
