import { AlertTriangle, ImageIcon, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatMoney } from "@/lib/utils";

type MockProduct = {
  id: string;
  name: string;
  sku: string;
  vendor: string;
  unit: string;
  packSize: number;
  imageUrl: string | null;
  price: number;
  cost: number;
  onHand: number;
  committed: number;
  soldLast30: number;
  lowStockThreshold: number;
  status: "active" | "inactive";
  storefront: "shown" | "hidden";
};

const products: MockProduct[] = [
  {
    id: "sparkling-water",
    name: "Sparkling Water 500ml x 24",
    sku: "SW-500-24",
    vendor: "Blue Ridge Beverage",
    unit: "case",
    packSize: 24,
    imageUrl:
      "https://images.unsplash.com/photo-1605193562561-4b010b9fdf78?auto=format&fit=crop&w=320&q=80",
    price: 48,
    cost: 31.5,
    onHand: 96,
    committed: 24,
    soldLast30: 84,
    lowStockThreshold: 20,
    status: "active",
    storefront: "shown",
  },
  {
    id: "orange-juice",
    name: "Orange Juice 1L",
    sku: "OJ-1L",
    vendor: "Morning Grove",
    unit: "each",
    packSize: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=320&q=80",
    price: 4.5,
    cost: 2.35,
    onHand: 28,
    committed: 16,
    soldLast30: 43,
    lowStockThreshold: 15,
    status: "active",
    storefront: "shown",
  },
  {
    id: "chips",
    name: "Chips Variety Pack",
    sku: "CV-12",
    vendor: "Snack Union",
    unit: "box",
    packSize: 12,
    imageUrl:
      "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=320&q=80",
    price: 12.5,
    cost: 7.8,
    onHand: 18,
    committed: 18,
    soldLast30: 29,
    lowStockThreshold: 8,
    status: "active",
    storefront: "hidden",
  },
  {
    id: "coffee",
    name: "Premium Coffee 250g",
    sku: "PC-250",
    vendor: "North Star Roasters",
    unit: "each",
    packSize: 1,
    imageUrl: null,
    price: 18,
    cost: 10.4,
    onHand: 8,
    committed: 2,
    soldLast30: 18,
    lowStockThreshold: 10,
    status: "inactive",
    storefront: "hidden",
  },
];

export function ProductCardMockups() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="min-w-0 space-y-3">
        <MockupHeader
          label="Mockup 1"
          title="Compact image row"
          description="Best when the inventory page needs to stay dense and sortable."
        />
        <div className="grid gap-3">
          {products.map((product) => (
            <CompactProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <MockupHeader
          label="Mockup 2"
          title="Photo-led stock card"
          description="Best when visual recognition matters more than maximum row density."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {products.map((product) => (
            <PhotoProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MockupHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{label}</Badge>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CompactProductCard({ product }: { product: MockProduct }) {
  const available = product.onHand - product.committed;
  const stockTone = getStockTone(product);

  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      <div className="grid min-h-28 grid-cols-[5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_8.5rem] sm:items-center">
        <ProductImage product={product} className="h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]" />

        <div className="min-w-0 space-y-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold leading-snug text-foreground">
                {product.name}
              </span>
              {product.status === "inactive" ? (
                <Badge variant="secondary" className="shrink-0">
                  inactive
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{product.sku}</span>
              <span>{product.vendor}</span>
              <span>{formatUnit(product)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:max-w-md">
            <Metric label="Available" value={available.toLocaleString()} tone={stockTone} />
            <Metric label="On hand" value={product.onHand.toLocaleString()} />
            <Metric label="Committed" value={product.committed.toLocaleString()} muted />
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-3 gap-2 border-t pt-3 sm:col-span-1 sm:block sm:space-y-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <SideStat label="Price" value={formatMoney(product.price)} />
          <SideStat label="Cost" value={formatMoney(product.cost)} />
          <SideStat label="30d sold" value={product.soldLast30.toLocaleString()} />
        </div>
      </div>
    </Card>
  );
}

function PhotoProductCard({ product }: { product: MockProduct }) {
  const available = product.onHand - product.committed;
  const stockTone = getStockTone(product);

  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="relative min-h-40 border-r bg-muted/40">
          <ProductImage product={product} className="h-full min-h-40 w-full rounded-none border-0" />
          <div className="absolute left-2 top-2">
            <StockBadge available={available} tone={stockTone} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="min-w-0 border-b p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {product.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{product.sku}</div>
              </div>
              <Badge
                variant={product.storefront === "shown" ? "success" : "secondary"}
                className="shrink-0"
              >
                {product.storefront}
              </Badge>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3 p-3">
            <Metric label="Available" value={available.toLocaleString()} tone={stockTone} />
            <Metric label="Price" value={formatMoney(product.price)} />
            <Metric label="On hand" value={product.onHand.toLocaleString()} />
            <Metric label="30d sold" value={product.soldLast30.toLocaleString()} />
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate">{product.vendor}</span>
            <span className="shrink-0">{formatUnit(product)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProductImage({
  product,
  className,
}: {
  product: MockProduct;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className,
      )}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-6 w-6" />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  muted = false,
}: {
  label: string;
  value: string;
  tone?: "good" | "low" | "out";
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-sm font-semibold tabular-nums text-foreground",
          muted && "font-medium text-muted-foreground",
          tone === "low" && "text-warning",
          tone === "out" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="truncate text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StockBadge({
  available,
  tone,
}: {
  available: number;
  tone: "good" | "low" | "out";
}) {
  const label = tone === "out" ? "Out" : tone === "low" ? "Low" : "In stock";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-card/95 px-2 py-1 text-xs font-semibold shadow-sm",
        tone === "good" && "border-success/20 text-success",
        tone === "low" && "border-warning/20 text-warning",
        tone === "out" && "border-destructive/20 text-destructive",
      )}
    >
      {tone === "good" ? <Package className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}: {available.toLocaleString()}
    </span>
  );
}

function formatUnit(product: MockProduct) {
  if (product.packSize > 1) return `${product.unit} of ${product.packSize}`;
  return product.unit;
}

function getStockTone(product: MockProduct): "good" | "low" | "out" {
  const available = product.onHand - product.committed;
  if (available <= 0) return "out";
  if (available <= product.lowStockThreshold) return "low";
  return "good";
}
