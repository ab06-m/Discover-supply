import "server-only";

export type StoreProduct = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  brand: string | null;
  price: string;
  unit: string;
  imageUrl: string | null;
  available: number;
  trackStock: boolean;
};

export type StoreProductsResponse = {
  items: StoreProduct[];
  pageContext: {
    hasMorePage: boolean;
    total?: number;
  };
  org: {
    currency: string;
  };
};

export function getMainAppUrl() {
  const configured = process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_MAIN_APP_URL;
  if (!configured?.trim()) {
    throw new Error("MAIN_APP_URL is not configured for the storefront.");
  }
  return configured;
}

export async function getStoreProducts(params: {
  page: number;
  limit: number;
  search?: string;
}) {
  const url = new URL("/api/store/products", getMainAppUrl());
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));
  if (params.search) url.searchParams.set("search", params.search);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Product catalog request failed (${res.status})`);
  }

  return (await res.json()) as StoreProductsResponse;
}
