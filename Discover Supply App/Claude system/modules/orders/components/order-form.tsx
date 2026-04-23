"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner, BarcodeScanButton } from "@/modules/inventory/components/barcode-scanner";
import { lookupByBarcode } from "@/modules/inventory/actions";
import { createOrder, searchOrderProducts } from "../actions";
import { formatMoney } from "@/lib/utils";

type CustomerOption = {
  id: string;
  name: string;
  storeCode: string | null;
};

type Line = {
  key: string;
  productId?: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

type ProductHit = {
  id: string;
  name: string;
  sku: string | null;
  price: string | number;
  onHand: number;
  committed: number;
};

type Props = {
  customers: CustomerOption[];
  currency: string;
  defaultTaxRate?: number;
  preselectedCustomerId?: string;
};

export function OrderForm({ customers, currency, defaultTaxRate = 0, preselectedCustomerId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState<string>(preselectedCustomerId ?? "");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
    };
  }, [lines]);

  function addHit(p: ProductHit) {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id);
      if (existing) {
        return ls.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...ls,
        {
          key: crypto.randomUUID(),
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: 1,
          unitPrice: parseFloat(String(p.price)) || 0,
          discount: 0,
          taxRate: defaultTaxRate,
        },
      ];
    });
    setQuery("");
    setResults([]);
  }

  async function runSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchOrderProducts(q);
      setResults(hits);
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
  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  function addBlankLine() {
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        name: "",
        sku: null,
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: defaultTaxRate,
      },
    ]);
  }

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
          items: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            sku: l.sku || undefined,
            quantity: l.quantity,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="customerId">Store</Label>
          <select
            id="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Walk-in / no customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.storeCode ? `${c.storeCode} · ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search product by name, SKU, or barcode…"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
              />
              {results.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background shadow-md">
                  {results.map((p) => {
                    const available = p.onHand - p.committed;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addHit(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{formatMoney(p.price, currency)}</div>
                          <div>
                            {available} avail
                            {p.committed > 0 && ` (${p.committed} reserved)`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No items yet. Search, scan, or{" "}
              <button type="button" onClick={addBlankLine} className="underline">
                add a custom line
              </button>
              .
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">Item</th>
                    <th className="p-2 w-20">Qty</th>
                    <th className="p-2 w-28">Unit price</th>
                    <th className="p-2 w-24">Disc.</th>
                    <th className="p-2 w-24">Tax %</th>
                    <th className="p-2 w-28 text-right">Line total</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const gross = l.unitPrice * l.quantity;
                    const afterDisc = Math.max(0, gross - l.discount);
                    const lineTotal = afterDisc + afterDisc * l.taxRate;
                    return (
                      <tr key={l.key} className="border-b">
                        <td className="p-2">
                          <Input
                            value={l.name}
                            onChange={(e) => updateLine(l.key, { name: e.target.value })}
                            placeholder="Item name"
                          />
                          {l.sku && <div className="mt-0.5 text-xs text-muted-foreground">{l.sku}</div>}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(l.key, { quantity: parseInt(e.target.value || "0", 10) })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={l.unitPrice}
                            onChange={(e) =>
                              updateLine(l.key, { unitPrice: parseFloat(e.target.value || "0") })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={l.discount}
                            onChange={(e) =>
                              updateLine(l.key, { discount: parseFloat(e.target.value || "0") })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
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
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatMoney(lineTotal, currency)}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLine(l.key)}
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

          {lines.length > 0 && (
            <div className="flex justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addBlankLine}>
                Add custom line
              </Button>
              <div className="space-y-1 text-right text-sm">
                <div>
                  Subtotal <span className="ml-4 font-medium">{formatMoney(totals.subtotal, currency)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="text-muted-foreground">
                    Discount <span className="ml-4">− {formatMoney(totals.discount, currency)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="text-muted-foreground">
                    Tax <span className="ml-4">{formatMoney(totals.tax, currency)}</span>
                  </div>
                )}
                <div className="text-base font-semibold">
                  Total <span className="ml-4">{formatMoney(totals.total, currency)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes (visible on invoice)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
            placeholder="Delivery instructions, PO number, etc."
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || lines.length === 0}>
          {isPending ? "Saving…" : "Create order"}
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
