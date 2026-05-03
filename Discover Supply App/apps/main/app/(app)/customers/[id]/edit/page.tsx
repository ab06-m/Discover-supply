import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { getCustomer } from "@/modules/customers/queries";
import { CustomerForm } from "@/modules/customers/components/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");
  const { id } = await params;
  const c = await getCustomer(org.id, id);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit customer</h1>
        <p className="text-sm text-muted-foreground">{c.name}</p>
      </div>
      <CustomerForm mode="edit" initial={c} />
    </div>
  );
}
