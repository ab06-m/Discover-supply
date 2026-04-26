import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { getCatalogItem } from "@/modules/storefront/queries";
import { AddToCartButton } from "@/modules/storefront/components/add-to-cart";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShopItem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await requireCustomer();
  const { id } = await params;
  const p = await getCatalogItem(active.org.id, id);
  if (!p) notFound();

  return (
    <div className="space-y-4">
      <Link href="/shop" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to catalog
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg border bg-slate-100">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {p.sku && <p className="text-sm text-muted-foreground">SKU {p.sku}</p>}
          </div>
          <div className="text-3xl font-bold">
            {formatMoney(p.price, active.org.currency)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              / {p.unit}
            </span>
          </div>
          {p.trackStock && (
            <div className={`inline-flex items-center gap-1.5 text-sm ${p.available <= 0 ? "text-rose-600" : "text-muted-foreground"}`}>
              {p.available <= 0 ? (
                <span>Out of stock</span>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  <span>{p.available} in stock</span>
                </>
              )}
            </div>
          )}
          <AddToCartButton
            productId={p.id}
            name={p.name}
            sku={p.sku}
            price={parseFloat(p.price)}
            imageUrl={p.imageUrl}
            available={p.available}
            trackStock={p.trackStock}
          />
          {p.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
