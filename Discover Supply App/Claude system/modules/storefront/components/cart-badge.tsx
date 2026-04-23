"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-store";

export function CartBadge() {
  const { items } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Link
      href="/shop/cart"
      className="relative inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-secondary"
    >
      <ShoppingCart className="h-4 w-4" />
      Cart
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
