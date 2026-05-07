"use client";

import Link from "next/link";
import {
  ExternalLink,
  Heart,
  Home,
  LayoutGrid,
  Moon,
  PackageSearch,
  ScanBarcode,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { StoreProduct, StoreProductsResponse } from "@/lib/products-api";

const PAGE_SIZE = 48;
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000";

function mainAppHref(path: string) {
  return new URL(path, MAIN_APP_URL).toString();
}

type CartItem = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  imageUrl: string | null;
  quantity: number;
};

type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type MatchedCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: CustomerAddress | null;
  shippingAddress: CustomerAddress | null;
};

type Panel = "cart" | "profile" | null;
type ScanStatus = "idle" | "scanning" | "found" | "missing" | "unsupported" | "error";
type CheckoutStatus = "idle" | "submitting" | "success" | "error";
type LookupStatus = "idle" | "loading" | "found" | "error";
type CheckoutMode = "match" | "new";
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorShape = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorShape;

function formatMoney(value: string | number, currency: string) {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount || 0);
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function addressLines(address: CustomerAddress | null | undefined) {
  if (!address) return [];

  const cityState = [address.city, address.state].filter(Boolean).join(", ");
  const cityLine = [cityState, address.postalCode].filter(Boolean).join(" ");

  return [address.line1, address.line2, cityLine, address.country].filter(
    (line): line is string => Boolean(line),
  );
}

function getBarcodeDetector() {
  if (typeof window === "undefined") return null;

  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector ?? null;
}

async function fetchProductsPage(page: number, search?: string) {
  const url = new URL("/api/products", window.location.origin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (search) url.searchParams.set("search", search);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Product page request failed (${response.status})`);

  return (await response.json()) as StoreProductsResponse;
}

function mergeProducts(current: StoreProduct[], incoming: StoreProduct[]) {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];

  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }

  return next;
}

export function BuyerBrowseExperience({
  items,
  currency,
  pageContext,
}: {
  items: StoreProduct[];
  currency: string;
  pageContext: StoreProductsResponse["pageContext"];
}) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [catalogItems, setCatalogItems] = useState(items);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const cartLoadedRef = useRef(false);
  const searchHydratedRef = useRef(false);
  const searchRequestRef = useRef(0);
  const headerRef = useRef<HTMLElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [searchPinned, setSearchPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePage, setHasMorePage] = useState(pageContext.hasMorePage);
  const [totalProducts, setTotalProducts] = useState(pageContext.total ?? items.length);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagingError, setPagingError] = useState("");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>("idle");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("match");
  const [customerLookup, setCustomerLookup] = useState("");
  const [matchedLookupValue, setMatchedLookupValue] = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState<MatchedCustomer | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const isDark = mode === "dark";
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number.parseFloat(item.price) * item.quantity,
    0,
  );
  const matchedAddress = matchedCustomer?.shippingAddress ?? matchedCustomer?.billingAddress ?? null;
  const matchedAddressLines = addressLines(matchedAddress);
  const portalLoginHref = mainAppHref("/portal/login?next=/portal");
  const portalShopHref = mainAppHref("/shop");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      cartLoadedRef.current = true;

      try {
        const raw = window.localStorage.getItem("discover-store.mockup-cart");
        if (raw) setCartItems(JSON.parse(raw) as CartItem[]);
      } catch {
        setCartItems([]);
      }
    }, 0);

    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!cartLoadedRef.current) return;

    window.localStorage.setItem("discover-store.mockup-cart", JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    let frame = 0;

    const updateSearchDock = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        setSearchPinned(scrollTop > 8);
      });
    };
    const interval = window.setInterval(updateSearchDock, 150);

    updateSearchDock();
    document.addEventListener("scroll", updateSearchDock, { passive: true });
    window.addEventListener("scroll", updateSearchDock, { passive: true });
    window.addEventListener("resize", updateSearchDock);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener("scroll", updateSearchDock);
      window.removeEventListener("scroll", updateSearchDock);
      window.removeEventListener("resize", updateSearchDock);
    };
  }, []);

  useEffect(() => {
    if (!searchHydratedRef.current) {
      searchHydratedRef.current = true;
      return;
    }

    const query = searchQuery.trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;

    const handle = window.setTimeout(async () => {
      setIsLoadingPage(true);
      setPagingError("");

      try {
        const result = await fetchProductsPage(1, query);
        if (searchRequestRef.current !== requestId) return;

        setCatalogItems(result.items);
        setCurrentPage(1);
        setHasMorePage(result.pageContext.hasMorePage);
        setTotalProducts(result.pageContext.total ?? result.items.length);
        setActiveSearch(query);
      } catch {
        if (searchRequestRef.current === requestId) {
          setPagingError("Could not load products. Try again.");
        }
      } finally {
        if (searchRequestRef.current === requestId) {
          setIsLoadingPage(false);
        }
      }
    }, query ? 250 : 0);

    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  const visibleItems = useMemo(() => {
    return catalogItems;
  }, [catalogItems]);

  const exactCatalogMatch = useMemo(() => {
    const query = normalizeCode(searchQuery);
    if (!query) return null;

    return (
      catalogItems.find((item) => normalizeCode(item.barcode) === query || normalizeCode(item.sku) === query) ?? null
    );
  }, [catalogItems, searchQuery]);

  function addToCart(product: StoreProduct) {
    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price,
          imageUrl: product.imageUrl,
          quantity: 1,
        },
      ];
    });
    setActivePanel("cart");
    setCheckoutStatus("idle");
    setCheckoutMessage("");
  }

  function updateQuantity(productId: string, quantity: number) {
    setCartItems((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== productId)
        : current.map((item) => (item.id === productId ? { ...item, quantity } : item)),
    );
    setCheckoutStatus("idle");
    setCheckoutMessage("");
  }

  function clearCustomerMatch() {
    setMatchedCustomer(null);
    setMatchedLookupValue("");
    setLookupStatus("idle");
    setLookupMessage("");
  }

  async function lookupCatalogCustomer() {
    const lookup = customerLookup.trim();
    if (!lookup) {
      setLookupStatus("error");
      setLookupMessage("Enter an email or telephone number.");
      return;
    }

    const lookupIsEmail = lookup.includes("@");
    setLookupStatus("loading");
    setLookupMessage("Looking for customer...");
    setCheckoutStatus("idle");
    setCheckoutMessage("");

    try {
      const response = await fetch("/api/customers/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: lookupIsEmail ? lookup : "",
          phone: lookupIsEmail ? "" : lookup,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        customer?: MatchedCustomer;
        error?: string;
      };

      if (!response.ok || !payload.customer) {
        throw new Error(payload.error ?? "No customer found.");
      }

      setMatchedCustomer(payload.customer);
      setMatchedLookupValue(lookup);
      setLookupStatus("found");
      setLookupMessage("Customer found. Confirm the details before submitting.");
    } catch (error) {
      setMatchedCustomer(null);
      setMatchedLookupValue("");
      setLookupStatus("error");
      setLookupMessage(error instanceof Error ? error.message : "Customer lookup failed.");
    }
  }

  async function submitCatalogOrder() {
    if (cartItems.length === 0 || checkoutStatus === "submitting") return;

    const lookup = customerLookup.trim();
    const name = newCustomerName.trim();
    const email = newCustomerEmail.trim();
    const phone = newCustomerPhone.trim();

    if (checkoutMode === "match" && !lookup) {
      setCheckoutStatus("error");
      setCheckoutMessage("Enter an email or telephone number to find your account.");
      return;
    }

    if (checkoutMode === "match" && (!matchedCustomer || matchedLookupValue !== lookup)) {
      setCheckoutStatus("error");
      setCheckoutMessage("Look up and confirm the customer before continuing.");
      return;
    }

    if (checkoutMode === "new" && (!name || (!email && !phone))) {
      setCheckoutStatus("error");
      setCheckoutMessage("Enter a customer name and at least one email or telephone number.");
      return;
    }

    const lookupIsEmail = lookup.includes("@");

    setCheckoutStatus("submitting");
    setCheckoutMessage(
      checkoutMode === "new" ? "Creating customer and draft order..." : "Matching customer...",
    );

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customer:
            checkoutMode === "match"
              ? {
                  mode: "match",
                  email: lookupIsEmail ? lookup : "",
                  phone: lookupIsEmail ? "" : lookup,
                }
              : {
                  mode: "new",
                  name,
                  email,
                  phone,
                },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        number?: string;
        error?: string;
        customerStatus?: "matched" | "created";
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create the order.");
      }

      setCartItems([]);
      setCheckoutStatus("success");
      setCheckoutMessage(
        `${payload.customerStatus === "created" ? "New customer created and " : ""}Draft catalog order ${
          payload.number ?? ""
        } created in Orders.`,
      );
    } catch (error) {
      setCheckoutStatus("error");
      setCheckoutMessage(error instanceof Error ? error.message : "Could not create the order.");
    }
  }

  async function loadMoreProducts() {
    if (isLoadingMore || !hasMorePage) return;

    const nextPage = currentPage + 1;
    setIsLoadingMore(true);
    setPagingError("");

    try {
      const result = await fetchProductsPage(nextPage, activeSearch);
      setCatalogItems((current) => mergeProducts(current, result.items));
      setCurrentPage(nextPage);
      setHasMorePage(result.pageContext.hasMorePage);
      setTotalProducts(result.pageContext.total ?? totalProducts);
    } catch {
      setPagingError("Could not load more products. Try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function decodeBarcodeImage(file: File) {
    const BarcodeDetector = getBarcodeDetector();
    if (!BarcodeDetector) return { status: "unsupported" as const, code: "" };

    const bitmap = await createImageBitmap(file);
    try {
      const detector = new BarcodeDetector({
        formats: [
          "aztec",
          "code_128",
          "code_39",
          "code_93",
          "codabar",
          "data_matrix",
          "ean_13",
          "ean_8",
          "itf",
          "pdf417",
          "qr_code",
          "upc_a",
          "upc_e",
        ],
      });
      const [barcode] = await detector.detect(bitmap);

      return barcode?.rawValue
        ? { status: "found" as const, code: barcode.rawValue }
        : { status: "missing" as const, code: "" };
    } finally {
      bitmap.close();
    }
  }

  async function handleBarcodeCapture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setScanStatus("scanning");
    setScanMessage("Scanning barcode...");

    try {
      const result = await decodeBarcodeImage(file);
      if (result.status === "unsupported") {
        setScanStatus("unsupported");
        setScanMessage("Camera capture is ready. Barcode decoding needs a supported mobile browser.");
        return;
      }

      if (result.status === "missing") {
        setScanStatus("missing");
        setScanMessage("No barcode found. Try a clearer, closer scan.");
        return;
      }

      const code = result.code.trim();
      const normalizedCode = normalizeCode(code);
      const productPage = await fetchProductsPage(1, code);
      const matchedItem =
        productPage.items.find(
          (item) => normalizeCode(item.barcode) === normalizedCode || normalizeCode(item.sku) === normalizedCode,
        ) ?? null;

      setSearchQuery(code);
      setCatalogItems(productPage.items);
      setCurrentPage(1);
      setHasMorePage(productPage.pageContext.hasMorePage);
      setTotalProducts(productPage.pageContext.total ?? productPage.items.length);
      setActiveSearch(code);

      if (matchedItem) {
        addToCart(matchedItem);
        setScanStatus("found");
        setScanMessage(`${matchedItem.name} added to cart.`);
      } else {
        setScanStatus("missing");
        setScanMessage(`No matching item for ${code}.`);
      }
    } catch {
      setScanStatus("error");
      setScanMessage("Unable to read that barcode image.");
    }
  }

  return (
    <div className="buyer-mockup-page" data-mode={mode}>
      <header className="buyer-page-header" ref={headerRef}>
        <Link href="/" className="buyer-brand">
          <LayoutGrid size={24} />
          <span>Discover Supply</span>
        </Link>

        <div className="buyer-header-actions">
          <button
            type="button"
            className="buyer-theme-toggle"
            onClick={() => setMode(isDark ? "light" : "dark")}
            aria-pressed={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
            <span>{isDark ? "Light" : "Dark"}</span>
          </button>
          <button
            type="button"
            className="buyer-account-button"
            onClick={() => setActivePanel("profile")}
          >
            <User size={17} />
            <span>Portal</span>
          </button>
          <button
            type="button"
            className="buyer-cart-button"
            onClick={() => setActivePanel("cart")}
            aria-label={`Open cart with ${totalQuantity} items`}
          >
            <ShoppingCart size={18} />
            <span>Cart</span>
            {totalQuantity > 0 ? <strong>{totalQuantity}</strong> : null}
          </button>
        </div>
      </header>

      <div className={`buyer-sticky-search${searchPinned ? " is-pinned" : ""}`}>
        <div className="buyer-search-shell">
          <div className="buyer-search-box">
            <Search size={18} />
            <input
              aria-label="Search products, SKU, or barcode"
              placeholder="Search products, SKU, or barcode"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setScanStatus("idle");
                setScanMessage("");
              }}
            />
            <button
              type="button"
              className="buyer-scan-button"
              aria-label="Scan barcode"
              onClick={() => barcodeInputRef.current?.click()}
            >
              <ScanBarcode size={19} />
            </button>
            <input
              ref={barcodeInputRef}
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleBarcodeCapture}
            />
          </div>
          <div className="buyer-scan-status" data-status={scanStatus} aria-live="polite">
            {scanMessage}
            {exactCatalogMatch ? (
              <button type="button" onClick={() => addToCart(exactCatalogMatch)}>
                Add match
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <main className="buyer-page-main">
        <section className="buyer-hero">
          <div className="buyer-hero-copy">
            <span className="buyer-kicker">Wholesale weekly</span>
            <h1>Restock faster with buyer pricing</h1>
            <p>Browse live inventory, reorder common items, and build carts quickly from your approved catalog.</p>
            <div className="buyer-hero-actions">
              <button type="button">Shop deals</button>
              <Link href="/">View full catalog</Link>
            </div>
          </div>

          <div className="buyer-hero-panel" aria-label="Buyer summary">
            <Sparkles size={21} />
            <strong>{totalProducts}</strong>
            <span>products available to browse</span>
          </div>
        </section>

        <section className="buyer-catalog">
          <div className="buyer-catalog-toolbar">
            <div>
              <span>Discover Supply</span>
              <h2>{searchQuery.trim() ? "Search results" : "Recommended products"}</h2>
              <p className="buyer-result-count">
                {isLoadingPage
                  ? "Loading products..."
                  : `${catalogItems.length} of ${totalProducts} products loaded`}
              </p>
            </div>

            <div className="buyer-chip-row" aria-label="Catalog filters">
              <button type="button" className="is-active">For you</button>
              <button type="button">Buy again</button>
              <button type="button">In stock</button>
              <button type="button">New</button>
            </div>
          </div>

          <section className="buyer-product-grid" aria-label="Product browse mockup">
            {visibleItems.map((item) => {
              const inStock = !item.trackStock || item.available > 0;

              return (
                <article className="buyer-product-card" key={item.id}>
                  <div className="buyer-product-image">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} />
                    ) : (
                      <div className="buyer-product-fallback">
                        <PackageSearch size={32} />
                      </div>
                    )}
                    <button type="button" aria-label={`Save ${item.name}`}>
                      <Heart size={16} />
                    </button>
                  </div>

                  <div className="buyer-product-copy">
                    <div className="buyer-product-stock">
                      <span className={inStock ? "is-in" : "is-out"}>
                        {inStock ? "In stock" : "Out of stock"}
                      </span>
                      {item.sku ? <span>{item.sku}</span> : null}
                    </div>
                    <h3>{item.name}</h3>
                    <div className="buyer-product-footer">
                      <strong>{formatMoney(item.price, currency)}</strong>
                      <button type="button" aria-label={`Add ${item.name} to cart`} onClick={() => addToCart(item)}>
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {visibleItems.length === 0 ? (
              <div className="buyer-empty-results">
                <PackageSearch size={28} />
                <p>No matching products found.</p>
              </div>
            ) : null}
          </section>
          <div className="buyer-pagination-row">
            {pagingError ? <p>{pagingError}</p> : null}
            {hasMorePage ? (
              <button type="button" onClick={loadMoreProducts} disabled={isLoadingMore || isLoadingPage}>
                {isLoadingMore ? "Loading..." : "Load more products"}
              </button>
            ) : (
              <span>All matching products loaded</span>
            )}
          </div>
        </section>
      </main>

      <nav className="buyer-access-bar" aria-label="Buyer quick access">
        <button type="button">
          <Home size={18} />
          <span>Browse</span>
        </button>
        <button type="button" onClick={() => setActivePanel("cart")}>
          <ShoppingCart size={18} />
          <span>Cart</span>
          {totalQuantity > 0 ? <strong>{totalQuantity}</strong> : null}
        </button>
        <button type="button" onClick={() => setActivePanel("profile")}>
          <User size={18} />
          <span>Portal</span>
        </button>
      </nav>

      {activePanel ? (
        <div className="buyer-panel-overlay" onClick={() => setActivePanel(null)}>
          <aside className="buyer-slide-panel" onClick={(event) => event.stopPropagation()}>
            <div className="buyer-panel-header">
              <div>
                <span>{activePanel === "cart" ? "Your order" : "Customer access"}</span>
                <h2>{activePanel === "cart" ? "Cart" : "Customer portal"}</h2>
              </div>
              <button type="button" aria-label="Close panel" onClick={() => setActivePanel(null)}>
                <X size={18} />
              </button>
            </div>

            {activePanel === "cart" ? (
              <div className="buyer-cart-panel">
                {cartItems.length === 0 ? (
                  <div className="buyer-panel-empty">
                    <ShoppingCart size={28} />
                    <p>{checkoutStatus === "success" ? checkoutMessage : "Your cart is ready when you are."}</p>
                    {checkoutStatus === "success" ? (
                      <a className="buyer-secondary-action buyer-panel-link" href={portalLoginHref}>
                        Open customer portal <ExternalLink size={15} />
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="buyer-cart-items">
                      {cartItems.map((item) => (
                        <div className="buyer-cart-line" key={item.id}>
                          <div className="buyer-cart-thumb">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt="" />
                            ) : (
                              <PackageSearch size={18} />
                            )}
                          </div>
                          <div className="buyer-cart-copy">
                            <strong>{item.name}</strong>
                            <span>{formatMoney(item.price, currency)}</span>
                          </div>
                          <div className="buyer-qty-stepper">
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                            <span>{item.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="buyer-cart-summary">
                      <span>Estimated total</span>
                      <strong>{formatMoney(cartTotal, currency)}</strong>
                    </div>
                    <div className="buyer-checkout-customer">
                      <div className="buyer-checkout-tabs" role="tablist" aria-label="Checkout customer">
                        <button
                          type="button"
                          className={checkoutMode === "match" ? "is-active" : ""}
                          onClick={() => {
                            setCheckoutMode("match");
                            setCheckoutStatus("idle");
                            setCheckoutMessage("");
                          }}
                        >
                          Existing customer
                        </button>
                        <button
                          type="button"
                          className={checkoutMode === "new" ? "is-active" : ""}
                          onClick={() => {
                            setCheckoutMode("new");
                            clearCustomerMatch();
                            setCheckoutStatus("idle");
                            setCheckoutMessage("");
                          }}
                        >
                          New customer
                        </button>
                      </div>

                      {checkoutMode === "match" ? (
                        <>
                          <label>
                            Email or telephone
                            <input
                              type="text"
                              inputMode="email"
                              placeholder="buyer@company.com or (555) 123-4567"
                              value={customerLookup}
                              onChange={(event) => {
                                setCustomerLookup(event.target.value);
                                clearCustomerMatch();
                                setCheckoutStatus("idle");
                                setCheckoutMessage("");
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="buyer-secondary-action"
                            onClick={lookupCatalogCustomer}
                            disabled={lookupStatus === "loading"}
                          >
                            {lookupStatus === "loading" ? "Looking for customer..." : "Find customer"}
                          </button>
                          {lookupMessage ? (
                            <p className="buyer-lookup-status" data-status={lookupStatus} aria-live="polite">
                              {lookupMessage}
                            </p>
                          ) : null}
                          {matchedCustomer ? (
                            <div className="buyer-customer-confirmation">
                              <span>Confirm customer</span>
                              <strong>{matchedCustomer.name}</strong>
                              {matchedAddressLines.length ? (
                                <address>
                                  {matchedAddressLines.map((line) => (
                                    <span key={line}>{line}</span>
                                  ))}
                                </address>
                              ) : (
                                <p>No address on file.</p>
                              )}
                              <div>
                                {matchedCustomer.email ? <small>{matchedCustomer.email}</small> : null}
                                {matchedCustomer.phone ? <small>{matchedCustomer.phone}</small> : null}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="buyer-new-customer-fields">
                          <label>
                            Customer name
                            <input
                              type="text"
                              placeholder="Company or buyer name"
                              value={newCustomerName}
                              onChange={(event) => {
                                setNewCustomerName(event.target.value);
                                setCheckoutStatus("idle");
                                setCheckoutMessage("");
                              }}
                            />
                          </label>
                          <label>
                            Email
                            <input
                              type="email"
                              placeholder="buyer@company.com"
                              value={newCustomerEmail}
                              onChange={(event) => {
                                setNewCustomerEmail(event.target.value);
                                setCheckoutStatus("idle");
                                setCheckoutMessage("");
                              }}
                            />
                          </label>
                          <label>
                            Telephone
                            <input
                              type="tel"
                              placeholder="(555) 123-4567"
                              value={newCustomerPhone}
                              onChange={(event) => {
                                setNewCustomerPhone(event.target.value);
                                setCheckoutStatus("idle");
                                setCheckoutMessage("");
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    <p className="buyer-checkout-status" data-status={checkoutStatus} aria-live="polite">
                      {checkoutMessage}
                    </p>
                    <button
                      type="button"
                      className="buyer-primary-action"
                      onClick={submitCatalogOrder}
                      disabled={checkoutStatus === "submitting" || (checkoutMode === "match" && !matchedCustomer)}
                    >
                      {checkoutStatus === "submitting"
                        ? "Creating draft..."
                        : checkoutMode === "match"
                          ? "Continue with customer"
                          : "Submit catalog order"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="buyer-profile-panel">
                <p>
                  Sign in to view orders, invoices, and account details. You can
                  keep browsing here or continue in the signed-in shop.
                </p>
                <a className="buyer-primary-action buyer-panel-link" href={portalLoginHref}>
                  Customer portal <ExternalLink size={15} />
                </a>
                <a className="buyer-secondary-action buyer-panel-link" href={portalShopHref}>
                  Shop with account <ExternalLink size={15} />
                </a>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
