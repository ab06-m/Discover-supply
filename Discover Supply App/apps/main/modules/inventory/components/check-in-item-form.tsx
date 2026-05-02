"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  Boxes,
  ChevronDown,
  ImagePlus,
  Package,
  ReceiptText,
  Save,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCheckInItem } from "../actions";
import { BarcodeScanner, BarcodeScanButton } from "./barcode-scanner";
import type { CategoryNode } from "../categories-actions";

type Props = {
  categories: CategoryNode[];
  defaultLowStockThreshold: number;
  currency: string;
};

function flattenCategories(nodes: CategoryNode[]) {
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

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-t bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold sm:px-6">
        <span className="inline-flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 px-4 pb-6 sm:grid-cols-2 sm:px-6">{children}</div>
    </details>
  );
}

function ImageDrop({
  id,
  name,
  label,
  multiple = false,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  multiple?: boolean;
  hint?: string;
}) {
  const [files, setFiles] = useState<string[]>([]);

  return (
    <label
      htmlFor={id}
      className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-background px-4 py-5 text-center transition hover:border-primary hover:bg-accent/40"
    >
      <ImagePlus className="mb-2 h-5 w-5 text-primary" />
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-1 max-w-48 text-xs text-muted-foreground">{hint}</span> : null}
      {files.length > 0 ? (
        <span className="mt-3 max-w-full truncate text-xs text-muted-foreground">
          {files.length === 1 ? files[0] : `${files.length} images selected`}
        </span>
      ) : null}
      <Input
        id={id}
        name={name}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []).map((f) => f.name))}
      />
    </label>
  );
}

export function CheckInItemForm({ categories, defaultLowStockThreshold, currency }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"goods" | "service">("goods");
  const [trackStock, setTrackStock] = useState(true);
  const [unit, setUnit] = useState<"each" | "case">("each");
  const [packSize, setPackSize] = useState(1);
  const [openingQuantity, setOpeningQuantity] = useState(0);
  const [openingQuantityType, setOpeningQuantityType] = useState<"each" | "box">("each");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryRows = useMemo(() => flattenCategories(categories), [categories]);
  const isService = kind === "service";
  const canTrack = !isService && trackStock;
  const isCase = unit === "case";
  const openingBaseQty =
    openingQuantityType === "box" ? openingQuantity * packSize : openingQuantity;

  function changeUnit(nextUnit: "each" | "case") {
    setUnit(nextUnit);
    if (nextUnit === "each") {
      setPackSize(1);
      setOpeningQuantityType("each");
    } else {
      setOpeningQuantityType("box");
    }
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("barcode", barcode);
    formData.set("unit", isService ? "each" : unit);
    formData.set("packSize", isCase && !isService ? String(packSize) : "1");
    formData.set("openingQuantity", canTrack ? String(openingQuantity) : "0");
    formData.set("openingUnitOfMeasure", canTrack ? openingQuantityType : "each");
    formData.set(
      "openingPackSize",
      canTrack && openingQuantityType === "box" ? String(packSize) : "1",
    );
    if (isService) {
      formData.set("trackStock", "false");
      formData.set("unit", "each");
      formData.set("packSize", "1");
      formData.set("openingQuantity", "0");
    }
    startTransition(async () => {
      try {
        const result = await createCheckInItem(formData);
        router.push(`/products/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save item.");
      }
    });
  }

  return (
    <form action={submit} className="overflow-hidden rounded-lg border bg-card shadow-card">
      <input type="hidden" name="returnable" value="true" />
      <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">New item</h2>
          <p className="text-sm text-muted-foreground">
            Create the item record and optionally check in opening inventory.
          </p>
        </div>
      </div>

      <div className="grid gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name" className="text-destructive">
              Name *
            </Label>
            <Input id="name" name="name" required maxLength={200} />
          </div>

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
            <Select id="categoryId" name="categoryId" defaultValue="">
              <option value="">Select a category</option>
              {categoryRows.map((category) => (
                <option key={category.id} value={category.id}>
                  {"\u00a0".repeat(category.depth * 4)}
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" maxLength={120} placeholder="Select or add brand" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input id="vendor" name="vendor" maxLength={200} placeholder="Vendor name" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <ImageDrop id="primaryImage" name="primaryImage" label="Upload Primary Image" />
          <ImageDrop
            id="additionalImages"
            name="additionalImages"
            label="Drag & Drop Additional Images"
            multiple
            hint="Up to 15 images, each not exceeding 5 MB."
          />
        </div>
      </div>

      <Section title="Identifiers" icon={<Package className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" maxLength={64} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <div className="flex gap-2">
            <Input
              id="barcode"
              name="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              maxLength={64}
            />
            <BarcodeScanButton onClick={() => setScannerOpen(true)} />
          </div>
        </div>
      </Section>

      <Section title="Item Description" icon={<ReceiptText className="h-4 w-4" />}>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} maxLength={2000} />
        </div>
      </Section>

      <Section title="Sales Information" icon={<ShoppingCart className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor="price" className="text-destructive">
            Selling Price *
          </Label>
          <div className="flex">
            <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
              {currency}
            </span>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue="0"
              className="rounded-l-none"
            />
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="salesDescription">Description</Label>
          <Textarea id="salesDescription" name="salesDescription" rows={3} maxLength={2000} />
        </div>
      </Section>

      <Section title="Purchase Information" icon={<Barcode className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor="cost" className="text-destructive">
            Cost Price *
          </Label>
          <div className="flex">
            <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
              {currency}
            </span>
            <Input
              id="cost"
              name="cost"
              type="number"
              min={0}
              step="0.01"
              defaultValue="0"
              className="rounded-l-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseVendor">Vendor</Label>
          <Input id="purchaseVendor" name="purchaseVendorDisplay" disabled placeholder="Uses Vendor above" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="purchaseDescription">Description</Label>
          <Textarea id="purchaseDescription" name="purchaseDescription" rows={3} maxLength={2000} />
        </div>
      </Section>

      <Section title="Track Inventory for This Item" icon={<Boxes className="h-4 w-4" />}>
        <div className="space-y-2 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="trackStock"
              checked={canTrack}
              disabled={isService}
              onChange={(e) => setTrackStock(e.target.checked)}
              className="h-4 w-4"
            />
            Track inventory for this item
          </label>
          <p className="text-xs text-muted-foreground">
            Services do not track stock. Goods can receive opening inventory here.
          </p>
        </div>
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
            disabled={isService || !isCase}
            onChange={(e) => setPackSize(Math.max(1, parseInt(e.target.value || "1", 10)))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openingQuantity">Starting quantity</Label>
          <Input
            id="openingQuantity"
            type="number"
            min={0}
            value={openingQuantity}
            disabled={!canTrack}
            onChange={(e) =>
              setOpeningQuantity(Math.max(0, parseInt(e.target.value || "0", 10)))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openingQuantityType">Starting quantity type</Label>
          <Select
            id="openingQuantityType"
            value={openingQuantityType}
            disabled={!canTrack || !isCase}
            onChange={(e) => setOpeningQuantityType(e.target.value as "each" | "box")}
          >
            <option value="each">Units</option>
            <option value="box">Cases</option>
          </Select>
        </div>
        {canTrack && openingQuantity > 0 ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">
            {openingQuantityType === "box"
              ? `${openingQuantity.toLocaleString()} case${
                  openingQuantity === 1 ? "" : "s"
                } x ${packSize.toLocaleString()} units = ${openingBaseQty.toLocaleString()} units added`
              : `${openingQuantity.toLocaleString()} unit${
                  openingQuantity === 1 ? "" : "s"
                } added`}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Reorder point</Label>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            placeholder={String(defaultLowStockThreshold)}
            disabled={!canTrack}
          />
        </div>
      </Section>

      <div className="border-t bg-card">
        <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold sm:px-6">
          <Store className="h-4 w-4 text-primary" />
          Online Store
        </div>
        <div className="grid gap-4 px-4 pb-6 sm:grid-cols-2 sm:px-6">
          <div className="space-y-2 sm:col-span-2">
          <Label>Show in online store</Label>
          <div className="flex h-10 items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="showInOnlineStore"
                value="true"
                defaultChecked
                className="h-4 w-4"
              />
              Yes
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="showInOnlineStore"
                value="false"
                className="h-4 w-4"
              />
              No
            </label>
          </div>
        </div>
        </div>
      </div>

      {error ? <p className="px-4 pt-4 text-sm text-destructive sm:px-6">{error}</p> : null}

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          <Trash2 className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          setScannerOpen(false);
        }}
      />
    </form>
  );
}
