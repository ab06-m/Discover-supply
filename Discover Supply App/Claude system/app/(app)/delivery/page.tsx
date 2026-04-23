import Link from "next/link";
import { Package, MapPin } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listDispatches } from "@/modules/dispatch/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  loaded: "bg-violet-100 text-violet-700",
  in_transit: "bg-amber-100 text-amber-700",
  delivered: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  returned: "bg-slate-200 text-slate-500",
};

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { org, role, user } = await requireActiveOrg();
  const { status } = await searchParams;

  // Drivers see only their own assignments.
  const rows =
    role === "driver"
      ? await listDispatches(org.id, { driverId: user.id })
      : await listDispatches(org.id, { status });

  const active = rows.filter((r) => r.status !== "delivered" && r.status !== "returned");
  const completed = rows.filter((r) => r.status === "delivered" || r.status === "returned");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {role === "driver" ? "My route" : "Delivery"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {active.length} active · {completed.length} completed
        </p>
      </div>

      {role !== "driver" && (
        <form className="flex gap-2">
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </form>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Active</h2>
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">No active deliveries.</p>
        )}
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {active.map((d) => (
            <DispatchCard key={d.id} d={d} currency={org.currency} />
          ))}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Completed
          </h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {completed.slice(0, 12).map((d) => (
              <DispatchCard key={d.id} d={d} currency={org.currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DispatchCard({
  d,
  currency,
}: {
  d: any;
  currency: string;
}) {
  const addr = d.deliveryAddress as {
    line1?: string;
    city?: string;
    state?: string;
  } | null;
  return (
    <Link href={`/delivery/${d.id}`}>
      <Card className="transition hover:border-primary">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{d.orderNumber}</div>
              <div className="text-sm text-muted-foreground">
                {d.customerName ?? "—"}
                {d.storeCode && ` · ${d.storeCode}`}
              </div>
            </div>
            <Badge
              className={`text-xs uppercase ${STATUS_COLORS[d.status] ?? ""}`}
              variant="secondary"
            >
              {d.status.replace("_", " ")}
            </Badge>
          </div>
          {addr?.line1 && (
            <div className="flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                {addr.line1}
                {(addr.city || addr.state) && `, ${[addr.city, addr.state].filter(Boolean).join(", ")}`}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Package className="h-3 w-3" />
              {formatMoney(d.total, currency)}
            </span>
            {d.scheduledAt && (
              <span className="text-muted-foreground">
                {new Date(d.scheduledAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
