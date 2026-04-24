import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, User } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { getDispatch } from "@/modules/dispatch/queries";
import { DeliverForm } from "@/modules/dispatch/components/deliver-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { id } = await params;
  const record = await getDispatch(org.id, id);
  if (!record) notFound();
  const { dispatch, order, customer, items } = record;
  const addr = dispatch.deliveryAddress as any;
  const done = dispatch.status === "delivered";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/delivery"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to deliveries
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {customer?.name ?? "Walk-in"} · {formatMoney(order.total, org.currency)}
          </p>
        </div>
        <Badge variant="secondary" className="uppercase">
          {dispatch.status.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {addr?.line1 ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div>{addr.line1}</div>
                {addr.line2 && <div>{addr.line2}</div>}
                <div>
                  {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No delivery address on file.</p>
          )}
          {addr?.line1 && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                [addr.line1, addr.city, addr.state, addr.postalCode]
                  .filter(Boolean)
                  .join(", "),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm text-primary underline"
            >
              Open in Maps
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between py-1.5">
                <div>
                  <div className="font-medium">{it.name}</div>
                  {it.sku && <div className="text-xs text-muted-foreground">{it.sku}</div>}
                </div>
                <div className="text-right font-semibold">× {it.quantity}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {done ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{dispatch.recipientName ?? "—"}</span>
              {dispatch.deliveredAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(dispatch.deliveredAt).toLocaleString()}
                </span>
              )}
            </div>
            {dispatch.deliveryNotes && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {dispatch.deliveryNotes}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {dispatch.proofImageUrl && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Proof photo</div>
                  <Image
                    src={dispatch.proofImageUrl}
                    alt="Proof"
                    width={600}
                    height={600}
                    className="rounded border"
                    unoptimized
                  />
                </div>
              )}
              {dispatch.signatureUrl && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Signature</div>
                  <Image
                    src={dispatch.signatureUrl}
                    alt="Signature"
                    width={600}
                    height={300}
                    className="rounded border bg-white"
                    unoptimized
                  />
                </div>
              )}
            </div>
            {dispatch.latitude && dispatch.longitude && (
              <a
                href={`https://www.google.com/maps/@${dispatch.latitude},${dispatch.longitude},18z`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-xs text-primary underline"
              >
                View GPS drop point
              </a>
            )}
          </CardContent>
        </Card>
      ) : (
        <DeliverForm dispatchId={dispatch.id} />
      )}
    </div>
  );
}
