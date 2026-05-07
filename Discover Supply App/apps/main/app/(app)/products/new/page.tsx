import Link from "next/link";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { ProductForm } from "@/modules/inventory/components/product-form";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { listCategories } from "@/modules/inventory/categories-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewProductPage() {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New item</h1>
        <p className="text-sm text-muted-foreground">Add an item to your catalog.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              mode="create"
              defaultLowStockThreshold={defaultLowStockThreshold}
              categories={categories}
            />
          </CardContent>
        </Card>

        <div className="hidden space-y-4 lg:block lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Product setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <RailRow label="Inventory default" value={`Low at ${defaultLowStockThreshold}`} />
              <RailRow label="Stock tracking" value="On for goods" />
              <RailRow label="Storefront" value="Hidden until selected" />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" form="product-form" className="w-full">
              Create product
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
              <Link href="/products">Cancel</Link>
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
      <span className="max-w-40 text-right font-medium">{value}</span>
    </div>
  );
}
