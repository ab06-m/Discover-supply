import Link from "next/link";
import { MapPin, Package, Route } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listDispatches } from "@/modules/dispatch/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { cn, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-primary/10 text-primary",
  loaded: "bg-accent text-accent-foreground",
  in_transit: "bg-warning/10 text-warning",
  delivered: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  returned: "bg-secondary text-secondary-foreground",
};

type DispatchRow = Awaited<ReturnType<typeof listDispatches>>[number];

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
    <div className="space-y-6">
      <PageHeader
        title={role === "driver" ? "My route" : "Delivery"}
        subtitle={`${active.length} active - ${completed.length} completed`}
      />

      {role !== "driver" && (
        <form className="w-48">
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Active</h2>
          <span className="text-sm text-muted-foreground">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No active deliveries"
            description={
              role === "driver"
                ? "New assignments will appear here when they are ready for your route."
                : "Assigned, loaded, and in-transit deliveries will appear here."
            }
            className="py-10"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((d) => (
              <DispatchCard key={d.id} d={d} currency={org.currency} />
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Completed</h2>
            <span className="text-sm text-muted-foreground">{completed.length}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {completed.slice(0, 12).map((d) => (
              <DispatchCard key={d.id} d={d} currency={org.currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DispatchCard({ d, currency }: { d: DispatchRow; currency: string }) {
  const addr = d.deliveryAddress as {
    line1?: string;
    city?: string;
    state?: string;
  } | null;

  return (
    <Link href={`/delivery/${d.id}`} className="block">
      <Card className="h-full shadow-card transition hover:border-primary hover:shadow-card-hover">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{d.orderNumber}</div>
              <div className="text-sm text-muted-foreground">
                {d.customerName ?? "-"}
                {d.storeCode && ` - ${d.storeCode}`}
              </div>
            </div>
            <Badge
              className={cn("shrink-0 text-xs uppercase", STATUS_COLORS[d.status] ?? "")}
              variant="secondary"
            >
              {d.status.replace("_", " ")}
            </Badge>
          </div>
          {addr?.line1 && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {addr.line1}
                {(addr.city || addr.state) &&
                  `, ${[addr.city, addr.state].filter(Boolean).join(", ")}`}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
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
