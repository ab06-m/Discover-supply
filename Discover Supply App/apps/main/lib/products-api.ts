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
