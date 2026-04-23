import Link from "next/link";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { listCatalog } from "@/modules/storefront/queries";
import { AddToCartButton } from "@/modules/storefront/components/add-to-cart";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShopCatalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { active } = await requireCustomer();
  const { q } = await searchParams;
  const items = await listCatalog(active.org.id, { search: q });

  return (
    <div className="space-y-4">
      <form>
        <Input
          name="q"
          placeholder="Search the catalog…"
          defaultValue={q ?? ""}
          className="max-w-md"
        />
      </form>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No products match.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <Link href={`/shop/${p.id}`} className="block">
                <div className="aspect-square bg-slate-100">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex-1">
                  <Link href={`/shop/${p.id}`} className="line-clamp-2 font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.sku && (
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {formatMoney(p.price, active.org.currency)}
                  </span>
                  {p.trackStock && (
                    <span
                      className={`text-xs ${p.available <= 0 ? "text-rose-600" : "text-muted-foreground"}`}
                    >
                      {p.available <= 0
                        ? "Out of stock"
                        : `${p.available} in stock`}
                    </span>
                  )}
                </div>
                <AddToCartButton
                  productId={p.id}
                  name={p.name}
                  sku={p.sku}
                  price={parseFloat(p.price)}
                  imageUrl={p.imageUrl}
                  available={p.available}
                  trackStock={p.trackStock}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
