import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { getProduct } from "@/modules/inventory/queries";
import { ProductForm } from "@/modules/inventory/components/product-form";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { listCategories } from "@/modules/inventory/categories-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>
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
    </div>
  );
}
