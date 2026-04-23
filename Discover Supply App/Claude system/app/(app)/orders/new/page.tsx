import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listCustomers } from "@/modules/customers/queries";
import { OrderForm } from "@/modules/orders/components/order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { customer } = await searchParams;
  const customers = await listCustomers(org.id);
  const defaultTaxRate = org.taxRate ? parseFloat(org.taxRate) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to orders
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">New order</h1>
      <OrderForm
        customers={customers.map((c) => ({ id: c.id, name: c.name, storeCode: c.storeCode }))}
        currency={org.currency}
        defaultTaxRate={defaultTaxRate}
        preselectedCustomerId={customer}
      />
    </div>
  );
}
