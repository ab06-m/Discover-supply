import { requireActiveOrg } from "@/lib/auth";
import { listCustomerSummaries } from "@/modules/customers/queries";
import { listCategories } from "@/modules/inventory/categories-actions";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { listSellProducts } from "@/modules/sell/queries";
import { SellCart } from "@/modules/sell/components/sell-cart";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const { org } = await requireActiveOrg();
  const settings = (org.settings ?? {}) as Record<string, any>;
  const { defaultLowStockThreshold } = getInventorySettings(settings);
  const defaultTaxRate = org.taxRate ? parseFloat(org.taxRate) : 0;

  const [products, customers, categories] = await Promise.all([
    listSellProducts(org.id),
    listCustomerSummaries(org.id),
    listCategories(),
  ]);

  return (
    <SellCart
      categories={categories}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        storeCode: customer.storeCode,
        paymentTerms: customer.paymentTerms,
      }))}
      currency={org.currency}
      defaultLowStockThreshold={defaultLowStockThreshold}
      defaultTaxRate={defaultTaxRate}
      products={products}
    />
  );
}
