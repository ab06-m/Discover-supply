import { requireActiveOrg } from "@/lib/auth";
import { listCustomerSummaries } from "@/modules/customers/queries";
import { getInitialStage, listStages } from "@/modules/orders/queries";
import { OrderForm } from "@/modules/orders/components/order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { customer } = await searchParams;
  const [customers, stages, initialStage] = await Promise.all([
    listCustomerSummaries(org.id),
    listStages(org.id),
    getInitialStage(org.id),
  ]);
  const defaultTaxRate = org.taxRate ? parseFloat(org.taxRate) : 0;
  const settings = (org.settings ?? {}) as Record<string, any>;
  const lowStockThreshold = Number(settings?.inventory?.defaultLowStockThreshold ?? 5);

  return (
    <div className="mx-auto max-w-6xl">
      <OrderForm
        customers={customers.map((c) => ({ id: c.id, name: c.name, storeCode: c.storeCode }))}
        currency={org.currency}
        defaultTaxRate={defaultTaxRate}
        preselectedCustomerId={customer}
        stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color, slug: s.slug }))}
        initialStageId={initialStage?.id ?? null}
        lowStockThreshold={lowStockThreshold}
      />
    </div>
  );
}
