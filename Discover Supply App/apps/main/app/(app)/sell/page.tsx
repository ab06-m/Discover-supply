import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/auth";
import { can, type Role } from "@/lib/permissions";
import { listCustomerSummaries } from "@/modules/customers/queries";
import { listCategories } from "@/modules/inventory/categories-actions";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { getOrder } from "@/modules/orders/queries";
import { listSellProducts } from "@/modules/sell/queries";
import { SellCart } from "@/modules/sell/components/sell-cart";

export const dynamic = "force-dynamic";

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const { orderId } = await searchParams;
  const settings = (org.settings ?? {}) as Record<string, any>;
  const { defaultLowStockThreshold } = getInventorySettings(settings);
  const defaultTaxRate = org.taxRate ? parseFloat(org.taxRate) : 0;

  const [products, customers, categories, orderRecord] = await Promise.all([
    listSellProducts(org.id),
    listCustomerSummaries(org.id),
    listCategories(),
    orderId ? getOrder(org.id, orderId) : Promise.resolve(null),
  ]);

  let editOrder: {
    id: string;
    number: string;
    customerId: string | null;
    stageSlug: string;
  } | null = null;

  if (orderId) {
    if (!orderRecord) notFound();
    const stageSlug = orderRecord.stage?.slug;
    if (
      !can(role as Role, "order.edit") ||
      (stageSlug !== "draft" && stageSlug !== "confirmed")
    ) {
      notFound();
    }
    editOrder = {
      id: orderRecord.order.id,
      number: orderRecord.order.number,
      customerId: orderRecord.order.customerId,
      stageSlug: stageSlug ?? "draft",
    };
  }

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
      editOrder={editOrder}
      products={products}
    />
  );
}
