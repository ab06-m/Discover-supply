"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BarcodeScanner, BarcodeScanButton } from "./barcode-scanner";
import { createProduct, updateProduct } from "../product-actions";
import type { Product } from "../schema";
import type { CategoryNode } from "../categories-actions";

type Props = {
  mode: "create" | "edit";
  initial?: Partial<Product>;
  defaultLowStockThreshold: number;
  categories?: CategoryNode[];
};

function flattenCategories(nodes: CategoryNode[] = []) {
  const children = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  const rows: Array<CategoryNode & { depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    for (const node of children.get(parentId) ?? []) {
      rows.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

export function ProductForm({ mode, initial, defaultLowStockThreshold, categories = [] }: Props) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [kind, setKind] = useState<"goods" | "service">(initial?.kind ?? "goods");
  const [trackStock, setTrackStock] = useState(initial?.trackStock ?? true);
  const [unit, setUnit] = useState<"each" | "case">(
    initial?.unit === "case" || initial?.unit === "box" || initial?.unit === "pack"
      ? "case"
      : "each",
  );
  const [packSize, setPackSize] = useState(initial?.packSize ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryRows = flattenCategories(categories);
  const isService = kind === "service";

  function changeUnit(nextUnit: "each" | "case") {
    setUnit(nextUnit);
    if (nextUnit === "each") setPackSize(1);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("barcode", barcode);
    fd.set("unit", isService ? "each" : unit);
    fd.set("packSize", !isService && unit === "case" ? String(packSize) : "1");
    if (isService) {
      fd.set("trackStock", "false");
      fd.set("unit", "each");
      fd.set("packSize", "1");
    }
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
    <form id="product-form" onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Product name *</Label>
        <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <div className="flex h-10 items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                value="goods"
                checked={kind === "goods"}
                onChange={() => {
                  setKind("goods");
                  setTrackStock(true);
                }}
                onClick={() => {
                  setKind("goods");
                  setTrackStock(true);
                }}
                className="h-4 w-4"
              />
              Goods
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                value="service"
                checked={kind === "service"}
                onChange={() => {
                  setKind("service");
                  setTrackStock(false);
                }}
                onClick={() => {
                  setKind("service");
                  setTrackStock(false);
                }}
                className="h-4 w-4"
              />
              Service
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""}>
            <option value="">Uncategorized</option>
            {categoryRows.map((category) => (
              <option key={category.id} value={category.id}>
                {"\u00a0".repeat(category.depth * 4)}
                {category.name}
              </option>
            ))}
          </Select>
        </div>
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
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" defaultValue={initial?.brand ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor</Label>
          <Input id="vendor" name="vendor" defaultValue={initial?.vendor ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unit">Sell/stock as</Label>
          <Select
            id="unit"
            value={isService ? "each" : unit}
            disabled={isService}
            onChange={(e) => changeUnit(e.target.value as "each" | "case")}
          >
            <option value="each">Unit</option>
            <option value="case">Case</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="packSize">Units per case</Label>
          <Input
            id="packSize"
            type="number"
            min={1}
            value={packSize}
            disabled={isService || unit === "each"}
            onChange={(e) => setPackSize(Math.max(1, parseInt(e.target.value || "1", 10)))}
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
          <Label htmlFor="lowStockThreshold">Low stock alert override</Label>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={initial?.lowStockThreshold ?? ""}
            placeholder={String(defaultLowStockThreshold)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the inventory default of {defaultLowStockThreshold}.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="salesDescription">Sales description</Label>
          <Textarea
            id="salesDescription"
            name="salesDescription"
            rows={3}
            defaultValue={initial?.salesDescription ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseDescription">Purchase description</Label>
          <Textarea
            id="purchaseDescription"
            name="purchaseDescription"
            rows={3}
            defaultValue={initial?.purchaseDescription ?? ""}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="trackStock"
          name="trackStock"
          checked={!isService && trackStock}
          disabled={isService}
          onChange={(e) => setTrackStock(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="trackStock" className="font-normal">Track inventory for this product</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
          <input
            type="checkbox"
            id="returnable"
            name="returnable"
            defaultChecked={initial?.returnable ?? true}
            className="h-4 w-4"
          />
          Returnable item
        </label>
        <label className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
          <input
            type="checkbox"
            id="showInOnlineStore"
            name="showInOnlineStore"
            defaultChecked={initial?.showInOnlineStore ?? false}
            className="h-4 w-4"
          />
          Show in online store
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 lg:hidden">
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
