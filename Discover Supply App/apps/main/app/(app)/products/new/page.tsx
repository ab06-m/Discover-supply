import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { ProductForm } from "@/modules/inventory/components/product-form";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { listCategories } from "@/modules/inventory/categories-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewProductPage() {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New item</h1>
        <p className="text-sm text-muted-foreground">Add an item to your catalog.</p>
      </div>
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
    </div>
  );
}
