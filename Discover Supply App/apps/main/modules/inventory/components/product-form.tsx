"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanner, BarcodeScanButton } from "./barcode-scanner";
import { createProduct, updateProduct } from "../actions";
import type { Product } from "../schema";

type Props = {
  mode: "create" | "edit";
  initial?: Partial<Product>;
};

export function ProductForm({ mode, initial }: Props) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("barcode", barcode);
    try {
      if (mode === "edit" && initial?.id) {
        fd.set("id", initial.id);
        await updateProduct(fd);
        router.push(`/products/${initial.id}`);
      } else {
        const res = await createProduct(fd);
        router.push(`/products/${res.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Product name *</Label>
        <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={initial?.sku ?? ""} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <div className="flex gap-2">
            <Input
              id="barcode"
              name="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="UPC/EAN"
            />
            <BarcodeScanButton onClick={() => setScanning(true)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <select
            id="unit"
            name="unit"
            defaultValue={initial?.unit ?? "each"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["each", "case", "box", "pack", "kg", "lb", "liter", "gallon"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="packSize">Units per pack</Label>
          <Input
            id="packSize"
            name="packSize"
            type="number"
            min={1}
            defaultValue={initial?.packSize ?? 1}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Selling price</Label>
          <Input id="price" name="price" type="number" step="0.01" min={0} defaultValue={initial?.price ?? "0"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Unit cost</Label>
          <Input id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={initial?.cost ?? "0"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Low stock alert</Label>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={initial?.lowStockThreshold ?? 0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="trackStock"
          name="trackStock"
          defaultChecked={initial?.trackStock ?? true}
          className="h-4 w-4"
        />
        <Label htmlFor="trackStock" className="font-normal">Track inventory for this product</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={(code) => {
          setBarcode(code);
          setScanning(false);
        }}
      />
    </form>
  );
}
