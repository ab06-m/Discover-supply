"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  ChevronRight,
  ClipboardList,
  ImageIcon,
  LayoutGrid,
  List,
  Minus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatMoney } from "@/lib/utils";
import { lookupByBarcode } from "@/modules/inventory/actions";
import { BarcodeScanner } from "@/modules/inventory/components/barcode-scanner";
import { createOrder, searchOrderProducts } from "@/modules/orders/actions";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
};

type Customer = {
  id: string;
  name: string;
  storeCode: string | null;
  paymentTerms?: string | null;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  unit?: string | null;
  packSize?: number | null;
  price: string | number;
  onHand: number;
  committed: number;
  lowStockThreshold?: number | null;
  trackStock?: boolean | null;
  imageUrl?: string | null;
};

type CartLine = {
  key: string;
  productId: string;
  name: string;
  sku: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitOfMeasure: "each" | "box";
  packSize: number;
  unitPrice: number;
  onHand: number;
  committed: number;
  trackStock: boolean;
  lowStockThreshold: number;
};

type Props = {
  categories: Category[];
  customers: Customer[];
  currency: string;
  defaultLowStockThreshold: number;
  defaultTaxRate: number;
  products: Product[];
};

const BOX_UNITS = new Set(["box", "case", "pack"]);

function productPrice(product: Product) {
  const parsed = parseFloat(String(product.price));
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultUomFor(product: Product): "each" | "box" {
  if ((product.packSize ?? 1) > 1 && BOX_UNITS.has(product.unit ?? "")) return "box";
  return "each";
}

function availableFor(line: CartLine | Product) {
  if ("trackStock" in line && line.trackStock === false) return Number.POSITIVE_INFINITY;
  return line.onHand - line.committed;
}

function stockTone(available: number, threshold: number) {
  if (!Number.isFinite(available)) return "open";
  if (available <= 0) return "out";
  if (available <= threshold) return "low";
  return "ok";
}

function compactName(name: string) {
  return name.length > 42 ? `${name.slice(0, 39)}...` : name;
}

export function SellCart({
  categories,
  customers,
  currency,
  defaultLowStockThreshold,
  defaultTaxRate,
  products,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [scanOpen, setScanOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [remoteResults, setRemoteResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const cartQuantityByProduct = useMemo(
    () => new Map(cart.map((line) => [line.productId, line.quantity])),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    const normalizedRemote = remoteResults.map((product) => productById.get(product.id) ?? product);
    const source = query.trim().length >= 2 && remoteResults.length > 0 ? normalizedRemote : products;
    const q = query.trim().toLowerCase();

    return source.filter((product) => {
      const available = availableFor(product);
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      const matchesStock = !onlyAvailable || !Number.isFinite(available) || available > 0;
      const matchesQuery =
        q.length < 2 ||
        product.name.toLowerCase().includes(q) ||
        product.sku?.toLowerCase().includes(q) ||
        product.barcode?.toLowerCase().includes(q);
      return matchesCategory && matchesStock && matchesQuery;
    });
  }, [categoryId, onlyAvailable, productById, products, query, remoteResults]);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  );
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = Math.max(0, subtotal - safeDiscount);
  const tax = taxable * defaultTaxRate;
  const total = taxable + tax;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function toggleMobileSearch() {
    setMobileSearchOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return nextOpen;
    });
  }

  async function runSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const hits = await searchOrderProducts(value.trim());
      setRemoteResults(hits as Product[]);
    } finally {
      setSearching(false);
    }
  }

  function addProduct(product: Product) {
    const existing = cart.find((line) => line.productId === product.id);
    if (existing) {
      setQuantity(existing.key, existing.quantity + 1);
      return;
    }

    const uom = defaultUomFor(product);
    const packSize = Math.max(1, product.packSize ?? 1);
    const unitPrice = uom === "box" ? productPrice(product) * packSize : productPrice(product);
    setCart((lines) => [
      ...lines,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        quantity: 1,
        unitOfMeasure: uom,
        packSize: uom === "box" ? packSize : 1,
        unitPrice,
        onHand: product.onHand,
        committed: product.committed,
        trackStock: product.trackStock !== false,
        lowStockThreshold: product.lowStockThreshold ?? defaultLowStockThreshold,
      },
    ]);
    setScanMessage(null);
  }

  function setQuantity(key: string, nextQuantity: number) {
    setCart((lines) =>
      lines.map((line) =>
        line.key === key ? { ...line, quantity: Math.max(1, Math.floor(nextQuantity || 1)) } : line,
      ),
    );
  }

  function removeLine(key: string) {
    setCart((lines) => lines.filter((line) => line.key !== key));
  }

  async function handleScan(code: string) {
    setScanMessage(null);
    const product = await lookupByBarcode(code);
    if (!product) {
      setScanMessage(`No product found for ${code}.`);
      return;
    }
    const richerProduct = productById.get(product.id) ?? (product as Product);
    addProduct(richerProduct);
    setScanMessage(`Added ${product.name}`);
  }

  function submitSale() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item before going to payment.");
      return;
    }

    startTransition(async () => {
      try {
        const discountRatio = subtotal > 0 ? safeDiscount / subtotal : 0;
        const response = await createOrder({
          customerId: customerId || undefined,
          internalNotes: "Created from Sell cart.",
          items: cart.map((line) => {
            const gross = line.unitPrice * line.quantity;
            return {
              productId: line.productId,
              name: line.name,
              sku: line.sku || undefined,
              quantity: line.quantity,
              unitOfMeasure: line.unitOfMeasure,
              packSize: line.packSize,
              unitPrice: line.unitPrice,
              discount: +(gross * discountRatio).toFixed(2),
              taxRate: defaultTaxRate,
            };
          }),
        });
        setCartOpen(false);
        router.push(`/orders/${response.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the sale.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">Sell</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fast staff cart for walk-in sales, phone orders, and back-office checkout.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("sell-cart")?.scrollIntoView({ behavior: "smooth" })}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </Button>
          <Button type="button" onClick={submitSale} disabled={isPending || cart.length === 0}>
            {isPending ? "Saving..." : "Go to Order"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={toggleMobileSearch}
              className={cn(
                "group inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-sky-400/50 hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mobileSearchOpen && "border-sky-400/70 bg-sky-500/10 ring-1 ring-sky-400/50",
              )}
              aria-label="Search products"
              title="Search products"
            >
              <Search className="h-7 w-7 transition-colors group-hover:text-sky-300" />
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="group relative inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-blue-400/50 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
              title="Cart"
            >
              <ShoppingCart className="h-7 w-7 transition-colors group-hover:text-blue-300" />
              {itemCount > 0 && (
                <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={submitSale}
              disabled={isPending || cart.length === 0}
              className="group inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-emerald-400/50 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Go to Order"
              title="Go to Order"
            >
              <ClipboardList className="h-7 w-7 transition-colors group-hover:text-emerald-300" />
              <ChevronRight className="-ml-1 h-5 w-5 transition-colors group-hover:text-emerald-300" />
            </button>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="group inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-violet-400/50 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Scan barcode"
              title="Scan barcode"
            >
              <Barcode className="h-7 w-7 transition-colors group-hover:text-violet-300" />
            </button>
          </div>

          <div
            className={cn(
              "sticky top-20 z-20 rounded-lg border bg-card/95 p-2 shadow-card backdrop-blur",
              mobileSearchOpen ? "block" : "hidden sm:block",
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                className="h-12 pl-10 pr-12 text-base"
                placeholder="Name, SKU, or barcode"
                value={query}
                onChange={(event) => runSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMobileSearchOpen(false);
                }}
              />
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="group absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:border-violet-400/50 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                aria-label="Scan barcode"
                title="Scan barcode"
              >
                <Barcode className="h-5 w-5 transition-colors group-hover:text-violet-300" />
              </button>
            </div>
            {(searching || scanMessage) && (
              <div className="mt-2 px-1 text-xs text-muted-foreground">
                {searching ? "Searching products..." : scanMessage}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-2 shadow-card sm:p-3">
            <div className="grid grid-cols-[minmax(120px,1fr)_auto_92px] items-center gap-2 sm:grid-cols-[minmax(260px,1fr)_auto_auto] sm:gap-3">
              <Select
                className="h-9 truncate px-2 py-1.5 text-xs sm:h-10 sm:px-3 sm:py-2 sm:text-sm"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <label className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium sm:h-10 sm:gap-2 sm:px-3 sm:text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={onlyAvailable}
                  onChange={(event) => setOnlyAvailable(event.target.checked)}
                />
                <span className="whitespace-nowrap">In stock</span>
              </label>
              <div className="grid h-9 grid-cols-2 rounded-md border bg-background p-1 sm:inline-flex sm:h-10 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded sm:h-8 sm:w-8",
                    viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded sm:h-8 sm:w-8",
                    viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                  aria-label="List view"
                  title="List view"
                >
                  <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-10 text-center">
              <ShoppingCart className="mx-auto h-9 w-9 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold">No products match</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search, category, or stock filter.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductTile
                  key={product.id}
                  currency={currency}
                  defaultLowStockThreshold={defaultLowStockThreshold}
                  onAdd={() => addProduct(product)}
                  product={product}
                  selectedQuantity={cartQuantityByProduct.get(product.id) ?? 0}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card shadow-card">
              {filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  currency={currency}
                  defaultLowStockThreshold={defaultLowStockThreshold}
                  onAdd={() => addProduct(product)}
                  product={product}
                  selectedQuantity={cartQuantityByProduct.get(product.id) ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        <aside id="sell-cart" className="hidden min-w-0 scroll-mt-24 sm:block lg:sticky lg:top-20 lg:self-start">
          <CartPanel className="overflow-hidden rounded-lg border bg-card shadow-card">
            <div className="border-b p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Tag className="h-4 w-4" />
                Select customer
              </div>
              <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.storeCode ? `${customer.storeCode} - ` : ""}
                    {customer.name}
                  </option>
                ))}
              </Select>
              {selectedCustomer?.paymentTerms && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Terms: {selectedCustomer.paymentTerms}
                </p>
              )}
            </div>

            <div className="max-h-[48vh] min-h-72 overflow-y-auto p-4 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 text-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Cart is empty</p>
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                    Tap product tiles or scan barcodes to build the sale.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <CartLineItem
                      key={line.key}
                      currency={currency}
                      line={line}
                      onDecrease={() => setQuantity(line.key, line.quantity - 1)}
                      onIncrease={() => setQuantity(line.key, line.quantity + 1)}
                      onQuantityChange={(quantity) => setQuantity(line.key, quantity)}
                      onRemove={() => removeLine(line.key)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
                  <span>Subtotal: {formatMoney(subtotal, currency)}</span>
                </div>
                {discountOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(parseFloat(event.target.value || "0"))}
                      aria-label="Discount amount"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDiscount(0);
                        setDiscountOpen(false);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      aria-label="Remove discount"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDiscountOpen(true)}
                    className="font-medium text-primary hover:underline"
                  >
                    Add discount
                  </button>
                )}
                {safeDiscount > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-{formatMoney(safeDiscount, currency)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span>{formatMoney(tax, currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 text-xl font-bold">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
              </div>

              {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

              <div className="mt-4 grid grid-cols-[52px_1fr] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setCart([]);
                    setDiscount(0);
                    setError(null);
                  }}
                  disabled={cart.length === 0 || isPending}
                  aria-label="Clear cart"
                  title="Clear cart"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  onClick={submitSale}
                  disabled={isPending || cart.length === 0}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {isPending ? "Saving..." : "Go to Order"}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </CartPanel>
        </aside>
      </div>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title="Cart" className="max-h-[92vh] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:hidden">
          <CartPanel className="flex max-h-[calc(92vh-49px)] flex-col bg-card">
            <div className="shrink-0 border-b p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Tag className="h-4 w-4" />
                Select customer
              </div>
              <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.storeCode ? `${customer.storeCode} - ` : ""}
                    {customer.name}
                  </option>
                ))}
              </Select>
              {selectedCustomer?.paymentTerms && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Terms: {selectedCustomer.paymentTerms}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 text-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Cart is empty</p>
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                    Tap product tiles or scan barcodes to build the sale.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <CartLineItem
                      key={line.key}
                      currency={currency}
                      line={line}
                      onDecrease={() => setQuantity(line.key, line.quantity - 1)}
                      onIncrease={() => setQuantity(line.key, line.quantity + 1)}
                      onQuantityChange={(quantity) => setQuantity(line.key, quantity)}
                      onRemove={() => removeLine(line.key)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
                  <span>Subtotal: {formatMoney(subtotal, currency)}</span>
                </div>
                {discountOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(parseFloat(event.target.value || "0"))}
                      aria-label="Discount amount"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDiscount(0);
                        setDiscountOpen(false);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      aria-label="Remove discount"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDiscountOpen(true)}
                    className="font-medium text-primary hover:underline"
                  >
                    Add discount
                  </button>
                )}
                {safeDiscount > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-{formatMoney(safeDiscount, currency)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span>{formatMoney(tax, currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 text-xl font-bold">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
              </div>

              {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

              <div className="mt-4 grid grid-cols-[52px_1fr] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setCart([]);
                    setDiscount(0);
                    setError(null);
                  }}
                  disabled={cart.length === 0 || isPending}
                  aria-label="Clear cart"
                  title="Clear cart"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  onClick={submitSale}
                  disabled={isPending || cart.length === 0}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {isPending ? "Saving..." : "Go to Order"}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </CartPanel>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scanOpen}
        continuous
        onScan={handleScan}
        onClose={() => setScanOpen(false)}
      />
    </div>
  );
}

function CartPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function ProductTile({
  currency,
  defaultLowStockThreshold,
  onAdd,
  product,
  selectedQuantity,
}: {
  currency: string;
  defaultLowStockThreshold: number;
  onAdd: () => void;
  product: Product;
  selectedQuantity: number;
}) {
  const available = availableFor(product);
  const tone = stockTone(available, product.lowStockThreshold ?? defaultLowStockThreshold);
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectedQuantity > 0 && "border-success ring-1 ring-success",
      )}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-9 w-9 text-muted-foreground" />
          </div>
        )}
        <span
          className={cn(
            "absolute left-2 top-2 h-3 w-3 rounded-full",
            tone === "out"
              ? "bg-destructive"
              : tone === "low"
                ? "bg-warning"
                : "bg-success",
          )}
        />
        {selectedQuantity > 0 && (
          <span className="absolute right-2 top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-success px-2 text-sm font-bold text-success-foreground">
            {selectedQuantity}
          </span>
        )}
      </div>
      <div className="bg-slate-700 p-3 text-white dark:bg-slate-800">
        <div className="truncate text-sm font-bold" title={product.name}>
          {compactName(product.name)}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{formatMoney(productPrice(product), currency)}</span>
          <span className="truncate text-xs text-white/70">
            {Number.isFinite(available) ? `${available} left` : "open"}
          </span>
        </div>
      </div>
    </button>
  );
}

function ProductRow({
  currency,
  defaultLowStockThreshold,
  onAdd,
  product,
  selectedQuantity,
}: {
  currency: string;
  defaultLowStockThreshold: number;
  onAdd: () => void;
  product: Product;
  selectedQuantity: number;
}) {
  const available = availableFor(product);
  const tone = stockTone(available, product.lowStockThreshold ?? defaultLowStockThreshold);
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-accent"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{product.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {product.sku ?? product.barcode ?? "No SKU"} - {Number.isFinite(available) ? `${available} left` : "open"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold">{formatMoney(productPrice(product), currency)}</div>
        <div
          className={cn(
            "text-xs font-medium",
            tone === "out" ? "text-destructive" : tone === "low" ? "text-warning" : "text-success",
          )}
        >
          {selectedQuantity > 0 ? `${selectedQuantity} in cart` : "Add"}
        </div>
      </div>
    </button>
  );
}

function CartLineItem({
  currency,
  line,
  onDecrease,
  onIncrease,
  onQuantityChange,
  onRemove,
}: {
  currency: string;
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const baseQuantity = line.quantity * line.packSize;
  const available = availableFor(line);
  const insufficient = Number.isFinite(available) && baseQuantity > available;
  const lineTotal = line.quantity * line.unitPrice;

  return (
    <div className="grid grid-cols-[92px_1fr_auto] gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </button>
        <Input
          type="number"
          min={1}
          value={line.quantity}
          onChange={(event) => onQuantityChange(parseInt(event.target.value || "1", 10))}
          className="h-9 w-12 px-1 text-center"
          aria-label={`Quantity for ${line.name}`}
        />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold" title={line.name}>
          {line.name}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatMoney(line.unitPrice, currency)}
          {line.unitOfMeasure === "box" && line.packSize > 1 ? ` - case of ${line.packSize}` : ""}
        </div>
        {insufficient && (
          <div className="mt-0.5 text-xs font-medium text-destructive">
            Insufficient stock ({available} available)
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${line.name}`}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-sm font-bold tabular-nums">{formatMoney(lineTotal, currency)}</div>
      </div>
    </div>
  );
}
