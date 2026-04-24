"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner, BarcodeScanButton } from "./barcode-scanner";
import { lookupByBarcode, receiveStock } from "../actions";

type Line = {
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost?: number;
};

type SearchHit = {
  id: string;
  name: string;
  sku: string | null;
};

type Props = {
  /** Callback to search products — provided by server component so we don't hit an API route */
  searchAction: (query: string) => Promise<SearchHit[]>;
};

export function ReceiveForm({ searchAction }: Props) {
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

  function addLine(p: { id: string; name: string; sku: string | null }) {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id);
      if (existing) {
        return ls.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...ls, { productId: p.id, name: p.name, sku: p.sku, quantity: 1 }];
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
      addLine({ id: product.id, name: product.name, sku: product.sku });
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
            unitCost: l.unitCost,
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
      <Card>
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
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span>{p.name}</span>
                      {p.sku && <span className="text-xs text-muted-foreground">{p.sku}</span>}
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
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">Product</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-32">Unit cost</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productId} className="border-b">
                      <td className="p-2">
                        <div className="font-medium">{l.name}</div>
                        {l.sku && <div className="text-xs text-muted-foreground">{l.sku}</div>}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateQty(l.productId, parseInt(e.target.value || "0", 10))}
                        />
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
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
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
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
