import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { listProducts } from "@/modules/inventory/queries";
import { ReceiveForm } from "@/modules/inventory/components/receive-form";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "stock.receive");

  async function searchAction(query: string) {
    "use server";
    const { org: o, role: r } = await requireActiveOrg();
    assertCan(r as Role, "product.read");
    const rows = await listProducts(o.id, { search: query, limit: 10 });
    return rows.map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
  }

  void org; // org context already validated
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Check in stock"
        subtitle="Scan barcodes or search products to receive a shipment into inventory."
      />
      <ReceiveForm searchAction={searchAction} />
    </div>
  );
}
