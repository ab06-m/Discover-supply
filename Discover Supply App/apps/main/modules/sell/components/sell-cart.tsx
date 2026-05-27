"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Barcode,
  Check,
  ChevronRight,
  ClipboardList,
  ImageIcon,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatMoney } from "@/lib/utils";
import { lookupByBarcode } from "@/modules/inventory/actions";
import { BarcodeScanner } from "@/modules/inventory/components/barcode-scanner";
import { appendOrderItems, createOrder } from "@/modules/orders/actions";
import { createCustomer } from "@/modules/customers/actions";
import { fetchSellProductsAction } from "@/modules/sell/actions";


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
  /** The per-unit (each) price — used to recalculate when switching UoM */
  basePrice: number;
  /** The product's configured case-pack size (always ≥ 1) */
  productPackSize: number;
  onHand: number;
  committed: number;
  trackStock: boolean;
  lowStockThreshold: number;
};

type EditOrderContext = {
  id: string;
  number: string;
  customerId: string | null;
  stageSlug: string;
};

type Props = {
  categories: Category[];
  customers: Customer[];
  currency: string;
  defaultLowStockThreshold: number;
  defaultTaxRate: number;
  editOrder?: EditOrderContext | null;
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

function cartStorageKey(orderId: string) {
  return `sell-add-items:${orderId}`;
}

export function SellCart({
  categories,
  customers,
  currency,
  defaultLowStockThreshold,
  defaultTaxRate,
  editOrder = null,
  products,
}: Props) {
  const router = useRouter();
  const isAddingToOrder = Boolean(editOrder);
  const [isPending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState(editOrder?.customerId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [scanOpen, setScanOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const [displayedProducts, setDisplayedProducts] = useState<Product[]>(products);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(products.length >= 180);
  const [offset, setOffset] = useState(products.length);
  const LIMIT = 40;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(!editOrder);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    displayedProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [products, displayedProducts]);

  const cartQuantityByProduct = useMemo(
    () => new Map(cart.map((line) => [line.productId, line.quantity])),
    [cart],
  );

  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!editOrder) return;
    try {
      const raw = sessionStorage.getItem(cartStorageKey(editOrder.id));
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      // Ignore invalid persisted cart data.
    } finally {
      setCartHydrated(true);
    }
  }, [editOrder]);

  useEffect(() => {
    if (!editOrder || !cartHydrated) return;
    sessionStorage.setItem(cartStorageKey(editOrder.id), JSON.stringify(cart));
  }, [cart, cartHydrated, editOrder]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchVal);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal]);

  // Load page 1 on filter changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    async function loadFilteredProducts() {
      setIsLoading(true);
      try {
        const hits = await fetchSellProductsAction({
          query: debouncedQuery,
          categoryId,
          onlyAvailable,
          limit: LIMIT,
          offset: 0,
        });
        setDisplayedProducts(hits as Product[]);
        setOffset(hits.length);
        setHasMore(hits.length >= LIMIT);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadFilteredProducts();
  }, [debouncedQuery, categoryId, onlyAvailable]);

  // Load more handler
  async function loadMore() {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const hits = await fetchSellProductsAction({
        query: debouncedQuery,
        categoryId,
        onlyAvailable,
        limit: LIMIT,
        offset,
      });
      setDisplayedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueHits = (hits as Product[]).filter((h) => !existingIds.has(h.id));
        return [...prev, ...uniqueHits];
      });
      setOffset((prev) => prev + hits.length);
      setHasMore(hits.length >= LIMIT);
    } catch (err) {
      console.error("Failed to load more products", err);
    } finally {
      setIsLoading(false);
    }
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  );
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = Math.max(0, subtotal - safeDiscount);
  const tax = taxable * defaultTaxRate;
  const total = taxable + tax;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedCustomer = localCustomers.find((customer) => customer.id === customerId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function toggleMobileSearch() {
    setMobileSearchOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return nextOpen;
    });
  }


  function addProduct(product: Product) {
    const existing = cart.find((line) => line.productId === product.id);
    if (existing) {
      setQuantity(existing.key, existing.quantity + 1);
      return;
    }

    const uom = defaultUomFor(product);
    const productPackSize = Math.max(1, product.packSize ?? 1);
    const eachPrice = productPrice(product);
    const unitPrice = uom === "box" ? eachPrice * productPackSize : eachPrice;
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
        packSize: uom === "box" ? productPackSize : 1,
        unitPrice,
        basePrice: eachPrice,
        productPackSize,
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

  function changeUom(key: string, nextUom: "each" | "box") {
    setCart((lines) =>
      lines.map((line) => {
        if (line.key !== key || line.unitOfMeasure === nextUom) return line;
        if (nextUom === "box") {
          return {
            ...line,
            unitOfMeasure: "box" as const,
            packSize: line.productPackSize,
            unitPrice: line.basePrice * line.productPackSize,
          };
        }
        return {
          ...line,
          unitOfMeasure: "each" as const,
          packSize: 1,
          unitPrice: line.basePrice,
        };
      }),
    );
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
      setError(
        isAddingToOrder
          ? "Add at least one new item before saving to the order."
          : "Add at least one item before going to payment.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const discountRatio = subtotal > 0 ? safeDiscount / subtotal : 0;
        const payloadItems = cart.map((line) => {
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
        });

        if (editOrder) {
          await appendOrderItems({
            orderId: editOrder.id,
            items: payloadItems,
          });
          sessionStorage.removeItem(cartStorageKey(editOrder.id));
          setCart([]);
          setDiscount(0);
          setCartOpen(false);
          router.push(`/orders/${editOrder.id}`);
          return;
        }

        const response = await createOrder({
          customerId: customerId || undefined,
          internalNotes: "Created from Sell cart.",
          items: payloadItems,
        });
        setCartOpen(false);
        router.push(`/orders/${response.id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isAddingToOrder
              ? "Could not add items to the order."
              : "Could not create the sale.",
        );
      }
    });
  }

  const submitLabel = isAddingToOrder ? "Add to order" : "Go to Order";
  const pendingLabel = isAddingToOrder ? "Saving..." : "Saving...";

  return (
    <div className="space-y-5">
      <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">
            {isAddingToOrder ? "Add items" : "Sell"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAddingToOrder
              ? `Adding new lines to order ${editOrder?.number}. Existing items stay on the order until you save.`
              : "Fast staff cart for walk-in sales, phone orders, and back-office checkout."}
          </p>
        </div>
      </div>

      {isAddingToOrder && editOrder ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative inline-flex h-5 w-5 shrink-0">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <Plus className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary text-primary-foreground" />
            </span>
            <span>
              Adding items to <span className="font-semibold">{editOrder.number}</span>
              {editOrder.stageSlug === "confirmed" ? (
                <span className="text-muted-foreground">
                  {" "}
                  — new lines will be reserved in inventory when saved
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}

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
              <Search className="h-7 w-7 transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-300" />
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="group relative inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-blue-400/50 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
              title="Cart"
            >
              <ShoppingCart className="h-7 w-7 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-300" />
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
              aria-label={submitLabel}
              title={submitLabel}
            >
              <ClipboardList className="h-7 w-7 transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-300" />
              <ChevronRight className="-ml-1 h-5 w-5 transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-300" />
            </button>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="group inline-flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-card transition hover:border-violet-400/50 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Scan barcode"
              title="Scan barcode"
            >
              <Barcode className="h-7 w-7 transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300" />
            </button>
          </div>

          <div
            className={cn(
              "sticky top-20 z-20 rounded-lg border bg-card/95 p-2 shadow-card backdrop-blur",
              mobileSearchOpen ? "block" : "hidden sm:block",
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  className="h-12 pl-10 pr-12 text-base"
                  placeholder="Name, SKU, or barcode"
                  value={searchVal}
                  onChange={(event) => setSearchVal(event.target.value)}
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
                  <Barcode className="h-5 w-5 transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300" />
                </button>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-input bg-background"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setCartOpen(true);
                    } else {
                      document.getElementById("sell-cart")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Cart{itemCount > 0 ? ` (${itemCount})` : ""}
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={submitSale}
                  disabled={isPending || cart.length === 0}
                >
                  {isPending ? pendingLabel : submitLabel}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            {(isLoading || scanMessage) && (
              <div className="mt-2 px-1 text-xs text-muted-foreground">
                {isLoading ? "Searching products..." : scanMessage}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-2 shadow-card sm:p-3">
            <div className="grid grid-cols-[minmax(120px,1fr)_auto_92px] items-center gap-2 sm:grid-cols-[minmax(260px,1fr)_auto_auto] sm:gap-3">
              <select
                className="h-9 truncate rounded-md border border-input bg-background px-2 py-1.5 text-xs sm:h-10 sm:px-3 sm:py-2 sm:text-sm"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
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

          {displayedProducts.length === 0 ? (
            isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed bg-card min-h-[300px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold">Loading catalog...</h3>
                <p className="mt-1 text-xs text-muted-foreground">Fetching matching inventory items</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-card p-10 text-center">
                <ShoppingCart className="mx-auto h-9 w-9 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold">No products match</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search, category, or stock filter.
                </p>
              </div>
            )
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                  {displayedProducts.map((product) => (
                    <ProductTile
                      key={product.id}
                      currency={currency}
                      defaultLowStockThreshold={defaultLowStockThreshold}
                      onAdd={() => addProduct(product)}
                      onDecrease={() => {
                        const line = cart.find((l) => l.productId === product.id);
                        if (line) setQuantity(line.key, line.quantity - 1);
                      }}
                      onRemove={() => {
                        const line = cart.find((l) => l.productId === product.id);
                        if (line) removeLine(line.key);
                      }}
                      product={product}
                      selectedQuantity={cartQuantityByProduct.get(product.id) ?? 0}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border bg-card shadow-card">
                  {displayedProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      currency={currency}
                      defaultLowStockThreshold={defaultLowStockThreshold}
                      onAdd={() => addProduct(product)}
                      onDecrease={() => {
                        const line = cart.find((l) => l.productId === product.id);
                        if (line) setQuantity(line.key, line.quantity - 1);
                      }}
                      onRemove={() => {
                        const line = cart.find((l) => l.productId === product.id);
                        if (line) removeLine(line.key);
                      }}
                      product={product}
                      selectedQuantity={cartQuantityByProduct.get(product.id) ?? 0}
                    />
                  ))}
                </div>
              )}

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="h-11 px-8 min-w-[160px] font-semibold border-primary/20 text-primary hover:bg-primary/5 transition duration-200"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                        Loading...
                      </>
                    ) : (
                      "Load More Products"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <aside id="sell-cart" className="hidden min-w-0 scroll-mt-24 lg:block lg:sticky lg:top-20 lg:self-start">
          <CartPanel className="rounded-lg border bg-card shadow-card">
            <div className="border-b p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Tag className="h-4 w-4" />
                Select customer
              </div>
              <CustomerSelector
                customers={localCustomers}
                value={customerId}
                onChange={setCustomerId}
                onNewCustomer={() => setNewCustomerOpen(true)}
                disabled={isAddingToOrder}
              />
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
                  <p className="mt-3 text-sm font-medium">
                    {isAddingToOrder ? "No new items yet" : "Cart is empty"}
                  </p>
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                    {isAddingToOrder
                      ? "Tap products or scan barcodes to add lines to this order."
                      : "Tap product tiles or scan barcodes to build the sale."}
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
                      onChangeUom={(uom) => changeUom(line.key, uom)}
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
                    if (editOrder) {
                      sessionStorage.removeItem(cartStorageKey(editOrder.id));
                    }
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
                  {isPending ? pendingLabel : submitLabel}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </CartPanel>
        </aside>
      </div>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title="Cart" className="max-h-[92vh] w-full max-w-[calc(100vw-2rem)] sm:max-w-md overflow-hidden p-0 lg:hidden">
          <CartPanel className="flex max-h-[calc(92vh-49px)] flex-col overflow-hidden rounded-lg bg-card">
            <div className="shrink-0 border-b p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Tag className="h-4 w-4" />
                Select customer
              </div>
              <CustomerSelector
                customers={localCustomers}
                value={customerId}
                onChange={setCustomerId}
                onNewCustomer={() => setNewCustomerOpen(true)}
                disabled={isAddingToOrder}
              />
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
                  <p className="mt-3 text-sm font-medium">
                    {isAddingToOrder ? "No new items yet" : "Cart is empty"}
                  </p>
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                    {isAddingToOrder
                      ? "Tap products or scan barcodes to add lines to this order."
                      : "Tap product tiles or scan barcodes to build the sale."}
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
                      onChangeUom={(uom) => changeUom(line.key, uom)}
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
                    if (editOrder) {
                      sessionStorage.removeItem(cartStorageKey(editOrder.id));
                    }
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
                  {isPending ? pendingLabel : submitLabel}
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

      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreated={(customer) => {
          setLocalCustomers((prev) => [...prev, customer]);
          setCustomerId(customer.id);
          setNewCustomerOpen(false);
        }}
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

// ─── Customer search combobox ─────────────────────────────────────────────────

function CustomerSelector({
  customers,
  value,
  onChange,
  onNewCustomer,
  disabled = false,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  onNewCustomer: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.storeCode ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function openDropdown() {
    setOpen(true);
    setSearch("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={disabled ? undefined : openDropdown}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected
            ? `${selected.storeCode ? selected.storeCode + " - " : ""}${selected.name}`
            : "Search customer..."}
        </span>
        <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {/* Search input */}
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type name or store code..."
                className="h-8 w-full rounded-sm border-0 bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {/* Clear selection */}
            {value && (
              <button
                type="button"
                onClick={() => select("")}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
                Clear selection
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No customers found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0 text-primary", c.id === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">
                    {c.storeCode ? <span className="mr-1 text-muted-foreground">{c.storeCode}</span> : null}
                    {c.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* New customer */}
          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNewCustomer();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <UserPlus className="h-4 w-4" />
              New customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick new-customer dialog ────────────────────────────────────────────────

const TERMS = [
  { value: "cod", label: "Cash on delivery" },
  { value: "net7", label: "Net 7" },
  { value: "net15", label: "Net 15" },
  { value: "net30", label: "Net 30" },
  { value: "net60", label: "Net 60" },
];

function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createCustomer(fd);
      const name = (fd.get("name") as string) ?? "";
      const storeCode = (fd.get("storeCode") as string) || null;
      const paymentTerms = (fd.get("paymentTerms") as string) || "net30";
      onCreated({ id: res.id, name, storeCode, paymentTerms });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New customer" className="max-w-md">
        <h2 className="text-lg font-semibold">New customer</h2>
        <p className="text-sm text-muted-foreground">Add a customer and select them right away.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Customer name *</Label>
            <Input id="nc-name" name="name" required placeholder="Acme Store" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-storeCode">Store code</Label>
              <Input id="nc-storeCode" name="storeCode" placeholder="S001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-paymentTerms">Payment terms</Label>
              <select
                id="nc-paymentTerms"
                name="paymentTerms"
                defaultValue="net30"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">Email</Label>
              <Input id="nc-email" name="email" type="email" placeholder="store@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Phone</Label>
              <Input id="nc-phone" name="phone" placeholder="+1 555 000 0000" />
            </div>
          </div>
          {/* Hidden required fields for the server action schema */}
          <input type="hidden" name="bill_line1" value="" />
          <input type="hidden" name="bill_city" value="" />
          <input type="hidden" name="bill_state" value="" />
          <input type="hidden" name="bill_postalCode" value="" />
          <input type="hidden" name="bill_country" value="" />
          <input type="hidden" name="ship_line1" value="" />
          <input type="hidden" name="ship_city" value="" />
          <input type="hidden" name="ship_state" value="" />
          <input type="hidden" name="ship_postalCode" value="" />
          <input type="hidden" name="ship_country" value="" />
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductTile({
  currency,
  defaultLowStockThreshold,
  onAdd,
  onDecrease,
  onRemove,
  product,
  selectedQuantity,
}: {
  currency: string;
  defaultLowStockThreshold: number;
  onAdd: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  product: Product;
  selectedQuantity: number;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const available = availableFor(product);
  const tone = stockTone(available, product.lowStockThreshold ?? defaultLowStockThreshold);

  useEffect(() => {
    if (!popoverOpen) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  return (
    <div
      className={cn(
        "group relative min-w-0 rounded-lg border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectedQuantity > 0 && "border-success ring-1 ring-success",
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        className="w-full text-left"
      >
        <div className="relative aspect-[4/3] bg-muted rounded-t-lg overflow-hidden">
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
        </div>
        <div className="border-t bg-card rounded-b-lg p-3 text-card-foreground dark:bg-slate-800 dark:text-white">
          <div className="truncate text-sm font-bold" title={product.name}>
            {compactName(product.name)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{formatMoney(productPrice(product), currency)}</span>
            <span className="truncate text-xs text-muted-foreground dark:text-white/70">
              {Number.isFinite(available) ? `${available} left` : "open"}
            </span>
          </div>
        </div>
      </button>

      {selectedQuantity > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPopoverOpen(!popoverOpen);
          }}
          className="absolute right-2 top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-success px-2 text-sm font-bold text-success-foreground hover:bg-success/90 transition shadow-md z-10"
        >
          {selectedQuantity}
        </button>
      )}

      {popoverOpen && selectedQuantity > 0 && (
        <div
          ref={popoverRef}
          className="absolute right-2 top-12 z-20 flex items-center gap-1.5 rounded-lg border bg-popover p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 dark:bg-slate-900 border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDecrease();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          
          <span className="min-w-8 text-center text-sm font-bold text-foreground">
            {selectedQuantity}
          </span>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition text-sm font-semibold"
            aria-label="Increase quantity"
          >
            +
          </button>
          
          <div className="h-6 w-px bg-border mx-1" />
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
              setPopoverOpen(false);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition"
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  currency,
  defaultLowStockThreshold,
  onAdd,
  onDecrease,
  onRemove,
  product,
  selectedQuantity,
}: {
  currency: string;
  defaultLowStockThreshold: number;
  onAdd: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  product: Product;
  selectedQuantity: number;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const available = availableFor(product);
  const tone = stockTone(available, product.lowStockThreshold ?? defaultLowStockThreshold);

  useEffect(() => {
    if (!popoverOpen) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  return (
    <div
      className={cn(
        "group relative flex w-full items-center justify-between border-b p-3 last:border-b-0 transition hover:bg-accent/40",
        selectedQuantity > 0 && "bg-success/5 border-success/30",
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        className="flex flex-1 items-center justify-between text-left focus-visible:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
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
        </div>
        <div className="text-right mr-3 shrink-0">
          <div className="text-sm font-bold">{formatMoney(productPrice(product), currency)}</div>
        </div>
      </button>

      {selectedQuantity > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen(!popoverOpen);
            }}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-success px-2 text-sm font-bold text-success-foreground hover:bg-success/90 transition shadow-md"
          >
            {selectedQuantity}
          </button>

          {popoverOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-10 z-20 flex items-center gap-1.5 rounded-lg border bg-popover p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 dark:bg-slate-900 border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrease();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              
              <span className="min-w-8 text-center text-sm font-bold text-foreground">
                {selectedQuantity}
              </span>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition text-sm font-semibold"
                aria-label="Increase quantity"
              >
                +
              </button>
              
              <div className="h-6 w-px bg-border mx-1" />
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                  setPopoverOpen(false);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition"
                aria-label="Remove item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartLineItem({
  currency,
  line,
  onDecrease,
  onIncrease,
  onQuantityChange,
  onChangeUom,
  onRemove,
}: {
  currency: string;
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onQuantityChange: (quantity: number) => void;
  onChangeUom: (uom: "each" | "box") => void;
  onRemove: () => void;
}) {
  const baseQuantity = line.quantity * line.packSize;
  const available = availableFor(line);
  const insufficient = Number.isFinite(available) && baseQuantity > available;
  const lineTotal = line.quantity * line.unitPrice;
  const canSwitchUom = line.productPackSize > 1;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3 bg-card text-card-foreground">
      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 border-border shrink-0">
        <button
          type="button"
          onClick={onDecrease}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition"
          aria-label="Decrease quantity"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        
        <Input
          type="number"
          min={1}
          value={line.quantity}
          onChange={(event) => onQuantityChange(parseInt(event.target.value || "1", 10))}
          className="h-8 w-10 border-0 bg-transparent p-0 text-center text-sm font-bold focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
          aria-label={`Quantity for ${line.name}`}
        />
        
        <button
          type="button"
          onClick={onIncrease}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent text-foreground transition text-sm font-semibold"
          aria-label="Increase quantity"
        >
          +
        </button>
        
        <div className="h-6 w-px bg-border mx-1" />
        
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition"
          aria-label={`Remove ${line.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground" title={line.name}>
          {line.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {formatMoney(line.unitPrice, currency)}
            {line.unitOfMeasure === "box" && line.packSize > 1 ? ` / case of ${line.packSize}` : " / unit"}
          </span>
          {canSwitchUom && (
            <button
              type="button"
              onClick={() => onChangeUom(line.unitOfMeasure === "each" ? "box" : "each")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                "hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                line.unitOfMeasure === "box"
                  ? "border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "border-input bg-background text-muted-foreground",
              )}
              title={line.unitOfMeasure === "each" ? "Switch to case" : "Switch to unit"}
            >
              <ArrowRightLeft className="h-3 w-3" />
              {line.unitOfMeasure === "each" ? "Unit" : "Case"}
            </button>
          )}
        </div>
        {insufficient && (
          <div className="mt-0.5 text-xs font-medium text-destructive">
            Insufficient stock ({available} available)
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-end justify-center">
        <div className="text-sm font-bold tabular-nums text-foreground">{formatMoney(lineTotal, currency)}</div>
      </div>
    </div>
  );
}

