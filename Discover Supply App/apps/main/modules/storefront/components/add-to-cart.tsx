"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cart } from "./cart-store";

type Props = {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  available?: number | null;
  trackStock?: boolean;
};

export function AddToCartButton({
  productId,
  name,
  sku,
  price,
  imageUrl,
  available,
  trackStock,
}: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = trackStock && available != null && available <= 0;

  function onAdd() {
    cart.add({ productId, name, sku, price, imageUrl }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (outOfStock) {
    return (
      <span className="inline-flex text-xs text-muted-foreground">Out of stock</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
        className="w-16"
      />
      <Button type="button" size="sm" onClick={onAdd}>
        {added ? (
          <>
            <Check className="mr-1 h-4 w-4" /> Added
          </>
        ) : (
          <>
            <ShoppingCart className="mr-1 h-4 w-4" /> Add
          </>
        )}
      </Button>
    </div>
  );
}
