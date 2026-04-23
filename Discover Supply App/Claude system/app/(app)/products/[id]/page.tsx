import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { getProduct } from "@/modules/inventory/queries";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { id } = await params;
  const product = await getProduct(org.id, id);
  if (!product) notFound();

  const movements = await db
    .select({
      id: schema.stockMovements.id,
      kind: schema.stockMovements.kind,
      onHandDelta: schema.stockMovements.onHandDelta,
      committedDelta: schema.stockMovements.committedDelta,
      note: schema.stockMovements.note,
      createdAt: schema.stockMovements.createdAt,
    })
    .from(schema.stockMovements)
    .where(
      and(
        eq(schema.stockMovements.orgId, org.id),
        eq(schema.stockMovements.productId, id),
      ),
    )
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(25);

  const available = product.onHand - product.committed;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/products" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to inventory
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {product.sku && <span>SKU {product.sku}</span>}
            {product.barcode && <span>Barcode {product.barcode}</span>}
            {!product.isActive && <Badge variant="secondary">inactive</Badge>}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/products/${id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={product.trackStock ? available : "—"} />
        <StatCard label="On hand" value={product.trackStock ? product.onHand : "—"} />
        <StatCard label="Committed" value={product.trackStock ? product.committed : "—"} />
        <StatCard label="Price" value={formatMoney(product.price, org.currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent stock activity</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements yet.</p>
          ) : (
            <ul className="space-y-2">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <div className="text-sm font-medium capitalize">{m.kind}</div>
                    {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      {m.onHandDelta !== 0 && (
                        <span className={m.onHandDelta > 0 ? "text-green-600" : "text-red-600"}>
                          {m.onHandDelta > 0 ? "+" : ""}
                          {m.onHandDelta} on-hand
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {m.committedDelta !== 0 && `${m.committedDelta > 0 ? "+" : ""}${m.committedDelta} committed`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
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

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
