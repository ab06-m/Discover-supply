"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Columns3,
  EyeOff,
  GripVertical,
  ImageIcon,
  Package,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatStockDisplay } from "@/modules/inventory/lib/format-stock";
import {
  getStockStatus,
  resolveLowStockThreshold,
} from "@/modules/inventory/lib/stock-rules";
import { cn, formatMoney } from "@/lib/utils";
import type { ProductListRow } from "@/modules/inventory/queries";

type FieldId =
  | "product"
  | "price"
  | "costPrice"
  | "available"
  | "onHand"
  | "committed"
  | "itemPerformance"
  | "barcode"
  | "brand"
  | "vendor"
  | "storefront";

type Field = {
  id: FieldId;
  label: string;
  render: (product: ProductListRow) => React.ReactNode;
};

const storageKey = "discover-supply.products.fields.v1";
const defaultOrder: FieldId[] = [
  "product",
  "available",
  "onHand",
  "committed",
  "price",
  "costPrice",
  "itemPerformance",
];
const optionalOrder: FieldId[] = ["barcode", "brand", "vendor", "storefront"];
const cardFieldPriority: FieldId[] = [
  "available",
  "onHand",
  "committed",
  "price",
  "costPrice",
  "itemPerformance",
];
const allFieldIds = [...defaultOrder, ...optionalOrder];

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sanitizeFieldOrder(value: unknown): FieldId[] {
  if (!Array.isArray(value)) return allFieldIds;
  const valid = value.filter((id): id is FieldId => allFieldIds.includes(id as FieldId));
  return [...valid, ...allFieldIds.filter((id) => !valid.includes(id))];
}

function sanitizeVisibleFields(value: unknown): Set<FieldId> {
  if (!Array.isArray(value)) return new Set(defaultOrder);
  const valid = value.filter((id): id is FieldId => allFieldIds.includes(id as FieldId));
  return new Set(valid);
}

function textValue(value: string | null | undefined) {
  return value?.trim() ? value : "-";
}

function stockValue(product: ProductListRow, defaultLowStockThreshold: number) {
  if (!product.trackStock) return <span className="text-muted-foreground">-</span>;

  const effectiveLowStockThreshold = resolveLowStockThreshold(
    product.lowStockThreshold,
    defaultLowStockThreshold,
  );
  const stockStatus = getStockStatus(Number(product.available), effectiveLowStockThreshold);

  return (
    <span className="inline-flex items-center gap-1">
      {stockStatus === "good" ? (
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <AlertTriangle
          className={cn(
            "h-3.5 w-3.5",
            stockStatus === "out" ? "text-destructive" : "text-warning",
          )}
        />
      )}
      <span
        className={cn(
          stockStatus === "out" && "text-destructive",
          stockStatus === "low" && "text-warning",
        )}
      >
        {product.available}
      </span>
    </span>
  );
}

function onHandValue(product: ProductListRow) {
  if (!product.trackStock) return <span className="text-muted-foreground">-</span>;

  return (
    <span
      className="inline-flex flex-col leading-tight"
      title={formatStockDisplay(product.onHand, product.packSize, product.unit ?? "each")}
    >
      <span>{product.onHand}</span>
      {(product.packSize ?? 1) > 1 ? (
        <span className="text-[10px] text-muted-foreground">
          {Math.floor(product.onHand / (product.packSize || 1))} case
          {Math.floor(product.onHand / (product.packSize || 1)) === 1 ? "" : "s"}
        </span>
      ) : null}
    </span>
  );
}

function formatProductUnit(product: ProductListRow) {
  return product.packSize > 1 ? `${product.unit}, case of ${product.packSize}` : product.unit;
}

export function ProductsList({
  rows,
  currency,
  defaultLowStockThreshold,
}: {
  rows: ProductListRow[];
  currency: string;
  defaultLowStockThreshold: number;
}) {
  const fields = React.useMemo<Field[]>(
    () => [
      {
        id: "product",
        label: "Product",
        render: (product) => (
          <div className="min-w-0">
            <Link
              href={`/products/${product.id}`}
              className="line-clamp-2 pr-20 font-semibold leading-snug hover:underline"
            >
              {product.name}
            </Link>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
              <span>SKU {product.sku ?? "-"}</span>
              <span>{formatProductUnit(product)}</span>
            </div>
          </div>
        ),
      },
      {
        id: "price",
        label: "Price",
        render: (product) => (
          <span className="font-medium">{formatMoney(product.price, currency)}</span>
        ),
      },
      {
        id: "costPrice",
        label: "Cost price",
        render: (product) => <span>{formatMoney(product.cost, currency)}</span>,
      },
      {
        id: "available",
        label: "Available",
        render: (product) => stockValue(product, defaultLowStockThreshold),
      },
      {
        id: "onHand",
        label: "On hand",
        render: onHandValue,
      },
      {
        id: "committed",
        label: "Committed",
        render: (product) => (
          <span className="text-muted-foreground">{product.trackStock ? product.committed : "-"}</span>
        ),
      },
      {
        id: "itemPerformance",
        label: "Item performance",
        render: (product) => (
          <span>
            {product.soldLast30 > 0 ? `${product.soldLast30} sold` : "No sales"}
            <span className="ml-1 text-xs text-muted-foreground">30d</span>
          </span>
        ),
      },
      {
        id: "barcode",
        label: "Barcode",
        render: (product) => <span className="text-muted-foreground">{product.barcode ?? "-"}</span>,
      },
      {
        id: "brand",
        label: "Brand",
        render: (product) => <span className="text-muted-foreground">{textValue(product.brand)}</span>,
      },
      {
        id: "vendor",
        label: "Vendor",
        render: (product) => <span className="text-muted-foreground">{textValue(product.vendor)}</span>,
      },
      {
        id: "storefront",
        label: "Storefront",
        render: (product) => (
          <Badge variant={product.showInOnlineStore ? "success" : "secondary"}>
            {product.showInOnlineStore ? "Shown" : "Hidden"}
          </Badge>
        ),
      },
    ],
    [currency, defaultLowStockThreshold],
  );

  const [fieldOrder, setFieldOrder] = React.useState<FieldId[]>(allFieldIds);
  const [visibleFields, setVisibleFields] = React.useState<Set<FieldId>>(
    () => new Set(defaultOrder),
  );
  const [storageLoaded, setStorageLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { order?: unknown; visible?: unknown };
        setFieldOrder(sanitizeFieldOrder(parsed.order));
        setVisibleFields(sanitizeVisibleFields(parsed.visible));
      }
    } catch {
      setFieldOrder(allFieldIds);
      setVisibleFields(new Set(defaultOrder));
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ order: fieldOrder, visible: Array.from(visibleFields) }),
    );
  }, [fieldOrder, storageLoaded, visibleFields]);

  const orderedFields = fieldOrder
    .map((id) => fields.find((field) => field.id === id))
    .filter((field): field is Field => Boolean(field));
  const activeFields = orderedFields.filter((field) => visibleFields.has(field.id));

  function toggleField(id: FieldId) {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetFields() {
    setFieldOrder(allFieldIds);
    setVisibleFields(new Set(defaultOrder));
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fieldOrder.length) return;
    setFieldOrder((current) => moveItem(current, index, nextIndex));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3 className="mr-2 h-4 w-4" />
              Fields
            </Button>
          </DialogTrigger>
          <DialogContent title="Edit product fields" className="max-w-md">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Show and reorder product info
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetFields}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {orderedFields.map((field, index) => {
                const isVisible = visibleFields.has(field.id);

                return (
                  <div
                    key={field.id}
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
                        onChange={() => toggleField(field.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move up"
                        aria-label={`Move ${field.label} up`}
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move down"
                        aria-label={`Move ${field.label} down`}
                        disabled={index === orderedFields.length - 1}
                        onClick={() => moveField(index, 1)}
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
      </div>

      {activeFields.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((product) => (
            <ProductCard key={product.id} fields={activeFields} product={product} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <EyeOff className="h-5 w-5" />
            <span>No visible fields</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductCard({ fields, product }: { fields: Field[]; product: ProductListRow }) {
  const productField = fields.find((field) => field.id === "product");
  const detailFields = fields.filter((field) => field.id !== "product");
  const prioritizedFields = [
    ...cardFieldPriority
      .map((id) => detailFields.find((field) => field.id === id))
      .filter((field): field is Field => Boolean(field)),
    ...detailFields.filter((field) => !cardFieldPriority.includes(field.id)),
  ];
  const mainFields = prioritizedFields.slice(0, 3);
  const railFields = prioritizedFields.slice(3, 6);
  const bottomFields = prioritizedFields.slice(6);

  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      <div
        className={cn(
          "grid min-h-28 grid-cols-[5rem_minmax(0,1fr)] gap-3 p-3",
          railFields.length
            ? "sm:grid-cols-[5.5rem_minmax(0,1fr)_8.5rem]"
            : "sm:grid-cols-[5.5rem_minmax(0,1fr)]",
          "sm:items-center",
        )}
      >
        <ProductImage product={product} />

        <div className="relative min-w-0 space-y-4">
          <Badge
            variant={product.isActive ? "success" : "secondary"}
            className="absolute right-0 top-0"
          >
            {product.isActive ? "Active" : "Inactive"}
          </Badge>
          {productField ? (
            <ProductField field={productField} product={product} emphasis hideLabel />
          ) : null}
          {mainFields.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 min-[430px]:grid-cols-3">
              {mainFields.map((field) => (
                <ProductField key={field.id} field={field} product={product} />
              ))}
            </div>
          ) : null}
        </div>

        {railFields.length ? (
          <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3 min-[430px]:grid-cols-3 sm:col-span-1 sm:block sm:space-y-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            {railFields.map((field) => (
              <ProductField key={field.id} field={field} product={product} />
            ))}
          </div>
        ) : null}
      </div>
      {bottomFields.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t bg-muted/20 p-3 min-[430px]:grid-cols-3 lg:grid-cols-6">
          {bottomFields.map((field) => (
            <ProductField key={field.id} field={field} product={product} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ProductImage({ product }: { product: ProductListRow }) {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground sm:h-[5.5rem] sm:w-[5.5rem]">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-6 w-6" />
      )}
    </div>
  );
}

function ProductField({
  field,
  product,
  emphasis = false,
  hideLabel = false,
  compact = false,
}: {
  field: Field;
  product: ProductListRow;
  emphasis?: boolean;
  hideLabel?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      {hideLabel ? null : (
        <div
          className={cn(
            "font-medium uppercase text-muted-foreground",
            compact ? "text-[10px] leading-tight" : "text-xs",
          )}
        >
          {field.label}
        </div>
      )}
      <div
        className={cn(
          "min-w-0 tabular-nums text-foreground",
          compact ? "text-xs" : "text-sm",
          hideLabel ? "mt-0" : "mt-1",
          emphasis ? "font-semibold leading-snug" : "truncate",
        )}
      >
        {field.render(product)}
      </div>
    </div>
  );
}
