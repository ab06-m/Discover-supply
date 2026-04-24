import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { CustomerForm } from "@/modules/customers/components/customer-form";

export default async function NewCustomerPage() {
  const { role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add store</h1>
        <p className="text-sm text-muted-foreground">Set up a new wholesale customer.</p>
      </div>
      <CustomerForm mode="create" />
    </div>
  );
}
