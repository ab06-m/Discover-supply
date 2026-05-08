"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { cart, useCart, cartTotal } from "@/modules/storefront/components/cart-store";
import { placeStorefrontOrder } from "@/modules/storefront/actions";

export default function CartPage() {
  const router = useRouter();
  const { items } = useCart();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const subtotal = cartTotal(items);

  function checkout() {
    setError(null);
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        const res = await placeStorefrontOrder({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          notes: notes || undefined,
        });
        cart.clear();
        router.push(`/portal/orders/${res.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild className="mt-4">
          <Link href="/shop">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your cart</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 py-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{i.name}</div>
                  {i.sku && <div className="text-xs text-muted-foreground">{i.sku}</div>}
                  <div className="text-sm">{formatMoney(i.price)}</div>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={i.quantity}
                  onChange={(e) =>
                    cart.setQty(i.productId, parseInt(e.target.value || "0", 10))
                  }
                  className="w-20"
                />
                <div className="w-24 text-right font-medium">
                  {formatMoney(i.price * i.quantity)}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => cart.remove(i.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tax calculated at checkout.
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery notes (optional)"
            rows={2}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={checkout} disabled={isPending} className="w-full">
            {isPending ? "Placing order…" : "Place order"}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
