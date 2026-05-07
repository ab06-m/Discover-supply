import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { getProduct } from "@/modules/inventory/queries";
import { ProductForm } from "@/modules/inventory/components/product-form";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { listCategories } from "@/modules/inventory/categories-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(org.id, id), listCategories()]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              mode="edit"
              initial={product}
              defaultLowStockThreshold={defaultLowStockThreshold}
              categories={categories}
            />
          </CardContent>
        </Card>

        <div className="hidden space-y-4 lg:block lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Product summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <RailRow label="Status" value={product.isActive ? "Active" : "Inactive"} />
              <RailRow label="Type" value={product.kind === "service" ? "Service" : "Goods"} />
              <RailRow label="Price" value={formatMoney(product.price, org.currency)} />
              <RailRow label="Cost" value={formatMoney(product.cost, org.currency)} />
              <RailRow
                label="Inventory"
                value={
                  product.trackStock
                    ? `Tracked, low at ${product.lowStockThreshold ?? defaultLowStockThreshold}`
                    : "Not tracked"
                }
              />
              <RailRow
                label="Storefront"
                value={product.showInOnlineStore ? "Visible" : "Hidden"}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" form="product-form" className="w-full">
              Save changes
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
              <Link href={`/products/${id}`}>Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-40 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}
