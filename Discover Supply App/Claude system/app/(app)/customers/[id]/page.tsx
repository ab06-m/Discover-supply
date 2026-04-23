import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { getCustomer } from "@/modules/customers/queries";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { id } = await params;
  const customer = await getCustomer(org.id, id);
  if (!customer) notFound();

  const recentOrders = await db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      total: schema.orders.total,
      stageId: schema.orders.stageId,
      stageName: schema.orderStages.name,
      stageColor: schema.orderStages.color,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.customerId, id)))
    .orderBy(desc(schema.orders.createdAt))
    .limit(10);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to stores
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {customer.storeCode && <span>Code {customer.storeCode}</span>}
            <Badge variant="outline" className="uppercase">{customer.paymentTerms}</Badge>
            {!customer.isActive && <Badge variant="secondary">inactive</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/customers/${id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link>
          </Button>
          <Button asChild>
            <Link href={`/orders/new?customer=${id}`}><Plus className="mr-2 h-4 w-4" />New order</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {customer.email ?? "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {customer.phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Tax ID:</span> {customer.taxId ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <AddressBlock addr={customer.shippingAddress} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.number}</Link>
                    <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.stageName && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: o.stageColor ?? "#64748b" }}
                      >
                        {o.stageName}
                      </span>
                    )}
                    <span className="font-medium">{formatMoney(o.total, org.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddressBlock({ addr }: { addr: any }) {
  if (!addr?.line1) return <div className="text-muted-foreground">No address on file.</div>;
  return (
    <div>
      <div>{addr.line1}</div>
      {addr.line2 && <div>{addr.line2}</div>}
      <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</div>
      {addr.country && <div>{addr.country}</div>}
    </div>
  );
}
