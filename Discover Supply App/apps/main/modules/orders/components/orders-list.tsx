"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Columns3,
  EyeOff,
  GripVertical,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { cn, formatMoney } from "@/lib/utils";
import { transitionOrderStage } from "../actions";
import type { OrderStage } from "../schema";

export type OrdersListRow = {
  id: string;
  number: string;
  total: string | number;
  amountPaid: string | number;
  createdAt: string;
  source: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  customerId: string | null;
  customerName: string | null;
  storeCode: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerBillingAddress: Address | null;
  customerShippingAddress: Address | null;
  customerPaymentTerms: string | null;
  customerTaxId: string | null;
  customerNotes: string | null;
  customerIsActive: boolean | null;
  salesRepName: string | null;
  salesRepEmail: string | null;
  deliveryStatus: string | null;
  itemCount: number;
  profit: string | number;
};

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type ColumnId =
  | "number"
  | "store"
  | "stage"
  | "date"
  | "total"
  | "delivery"
  | "salesRep"
  | "payment"
  | "items"
  | "profit";

type Column = {
  id: ColumnId;
  label: string;
  align?: "right";
  render: (order: OrdersListRow) => React.ReactNode;
};

type StageOption = Pick<OrderStage, "id" | "name" | "color" | "effect" | "isTerminal">;

const storageKey = "discover-supply.orders.columns.v4";
const headerColumnIds = new Set<ColumnId>(["number", "stage", "date"]);
const defaultOrder: ColumnId[] = [
  "number",
  "stage",
  "date",
  "store",
  "profit",
  "total",
  "salesRep",
  "items",
  "payment",
];
const optionalOrder: ColumnId[] = ["delivery"];
const allColumnIds = [...defaultOrder, ...optionalOrder];
const dailyDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});
const dailyKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/New_York",
});

function moneyValue(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function formatWords(value: string | null) {
  if (!value) return "-";
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCatalogOrder(source: string | null) {
  return source === "catalog_order" || source === "Catalog order";
}

function paymentStatus(order: OrdersListRow) {
  const paid = moneyValue(order.amountPaid);
  const total = moneyValue(order.total);
  if (total <= 0 || paid <= 0) return "Unpaid";
  if (paid >= total) return "Paid";
  return "Partial";
}

function colorWithAlpha(color: string, alpha: number) {
  const hex = color.trim().replace("#", "");
  const opacity = Math.round(alpha * 100);

  if (/^[\da-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.split("").map((part) => parseInt(`${part}${part}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (/^[\da-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

function stageColorStyles(color: string): React.CSSProperties {
  return {
    color,
    borderColor: colorWithAlpha(color, 0.35),
    backgroundColor: colorWithAlpha(color, 0.12),
  };
}

function formatAddress(address: Address | null) {
  if (!address) return "-";
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const parts = [address.line1, address.line2, cityLine, address.country].filter(Boolean);
  return parts.length ? parts.join("\n") : "-";
}

function groupOrdersByDay(rows: OrdersListRow[]) {
  const groups = new Map<
    string,
    { key: string; date: Date; orderCount: number; total: number; rows: OrdersListRow[] }
  >();

  for (const row of rows) {
    const date = new Date(row.createdAt);
    const key = dailyKeyFormatter.format(date);
    const existing = groups.get(key);

    if (existing) {
      existing.orderCount += 1;
      existing.total += moneyValue(row.total);
      existing.rows.push(row);
    } else {
      groups.set(key, {
        key,
        date,
        orderCount: 1,
        total: moneyValue(row.total),
        rows: [row],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sanitizeColumnOrder(value: unknown): ColumnId[] {
  if (!Array.isArray(value)) return allColumnIds;
  const valid = value.filter((id): id is ColumnId => allColumnIds.includes(id as ColumnId));
  return [...valid, ...allColumnIds.filter((id) => !valid.includes(id))];
}

function sanitizeVisibleColumns(value: unknown): Set<ColumnId> {
  if (!Array.isArray(value)) return new Set(defaultOrder);
  const valid = value.filter((id): id is ColumnId => allColumnIds.includes(id as ColumnId));
  return new Set(valid);
}

export function OrdersList({
  rows,
  currency,
  stages,
  canAdvance,
}: {
  rows: OrdersListRow[];
  currency: string;
  stages: StageOption[];
  canAdvance: boolean;
}) {
  const [selectedCustomer, setSelectedCustomer] = React.useState<OrdersListRow | null>(null);

  const columns = React.useMemo<Column[]>(
    () => [
      {
        id: "number",
        label: "Order",
        render: (order) => (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
              {order.number}
            </Link>
            {isCatalogOrder(order.source) ? <Badge variant="secondary">Catalog order</Badge> : null}
          </div>
        ),
      },
      {
        id: "store",
        label: "Store",
        render: (order) =>
          order.customerName ? (
            <button
              type="button"
              onClick={() => setSelectedCustomer(order)}
              className="min-w-0 text-left hover:underline"
            >
              <span className="block font-medium">{order.customerName}</span>
              {order.storeCode ? (
                <span className="block text-xs text-muted-foreground">{order.storeCode}</span>
              ) : null}
            </button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "stage",
        label: "Stage",
        render: (order) =>
          order.stageName ? (
            <OrderStageControl order={order} stages={stages} canAdvance={canAdvance} />
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "date",
        label: "Date",
        render: (order) => (
          <span className="text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "total",
        label: "Total",
        align: "right",
        render: (order) => <span className="font-medium">{formatMoney(order.total, currency)}</span>,
      },
      {
        id: "delivery",
        label: "Delivery",
        render: (order) => (
          <span className="text-muted-foreground">{formatWords(order.deliveryStatus)}</span>
        ),
      },
      {
        id: "salesRep",
        label: "Sales rep",
        render: (order) => (
          <span className="text-muted-foreground">
            {order.salesRepName ?? order.salesRepEmail ?? "-"}
          </span>
        ),
      },
      {
        id: "payment",
        label: "Payment",
        render: (order) => {
          const status = paymentStatus(order);
          return (
            <Badge
              variant={status === "Paid" ? "success" : status === "Partial" ? "warning" : "secondary"}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        id: "items",
        label: "Items",
        align: "right",
        render: (order) => <span className="tabular-nums">{order.itemCount}</span>,
      },
      {
        id: "profit",
        label: "Profit",
        align: "right",
        render: (order) => (
          <span className={cn("font-medium", moneyValue(order.profit) < 0 && "text-destructive")}>
            {formatMoney(order.profit, currency)}
          </span>
        ),
      },
    ],
    [canAdvance, currency, stages],
  );

  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(allColumnIds);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<ColumnId>>(
    () => new Set(defaultOrder),
  );
  const [storageLoaded, setStorageLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { order?: unknown; visible?: unknown };
        setColumnOrder(sanitizeColumnOrder(parsed.order));
        setVisibleColumns(sanitizeVisibleColumns(parsed.visible));
      }
    } catch {
      setColumnOrder(allColumnIds);
      setVisibleColumns(new Set(defaultOrder));
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ order: columnOrder, visible: Array.from(visibleColumns) }),
    );
  }, [columnOrder, storageLoaded, visibleColumns]);

  const orderedColumns = columnOrder
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is Column => Boolean(column));
  const activeColumns = orderedColumns.filter((column) => visibleColumns.has(column.id));
  const dailyGroups = React.useMemo(() => groupOrdersByDay(rows), [rows]);

  function toggleColumn(id: ColumnId) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetColumns() {
    setColumnOrder(allColumnIds);
    setVisibleColumns(new Set(defaultOrder));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= columnOrder.length) return;
    setColumnOrder((current) => moveItem(current, index, nextIndex));
  }

  return (
    <div className="space-y-3">
      <Dialog
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
      >
        {selectedCustomer ? <CustomerDialogContent customer={selectedCustomer} /> : null}
      </Dialog>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DialogTrigger>
          <DialogContent title="Edit order columns" className="max-w-md">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Show and reorder fields
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetColumns}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {orderedColumns.map((column, index) => {
                const isVisible = visibleColumns.has(column.id);

                return (
                  <div
                    key={column.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
                      isVisible ? "bg-card" : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <label className="flex min-w-0 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumn(column.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="truncate">{column.label}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move up"
                        aria-label={`Move ${column.label} up`}
                        disabled={index === 0}
                        onClick={() => moveColumn(index, -1)}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move down"
                        aria-label={`Move ${column.label} down`}
                        disabled={index === orderedColumns.length - 1}
                        onClick={() => moveColumn(index, 1)}
                        className="h-8 w-8"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeColumns.length > 0 ? (
        <div className="space-y-5">
          {dailyGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <DailySalesCard
                date={group.date}
                orderCount={group.orderCount}
                total={group.total}
                currency={currency}
              />
              <div className="grid gap-3">
                {group.rows.map((order) => (
                  <OrderCard key={order.id} columns={activeColumns} order={order} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <EyeOff className="h-5 w-5" />
            <span>No visible columns</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function OrderStageControl({
  order,
  stages,
  canAdvance,
}: {
  order: OrdersListRow;
  stages: StageOption[];
  canAdvance: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(order.stageId ?? "");
  const [isPending, startTransition] = React.useTransition();
  const color = order.stageColor ?? "#64748b";

  React.useEffect(() => {
    setValue(order.stageId ?? "");
  }, [order.stageId]);

  if (!canAdvance) {
    return (
      <span
        className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
        style={stageColorStyles(color)}
      >
        {order.stageName}
      </span>
    );
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const toStageId = event.target.value;
    const previous = value;
    const target = stages.find((stage) => stage.id === toStageId);
    if (!target || toStageId === previous) return;

    if (target.effect === "consume" || target.effect === "release" || target.isTerminal) {
      if (!confirm(`Move to "${target.name}"? This will ${describeStageEffect(target.effect)}.`)) {
        setValue(previous);
        return;
      }
    }

    setValue(toStageId);
    startTransition(async () => {
      try {
        await transitionOrderStage({ orderId: order.id, toStageId });
        router.refresh();
      } catch (error) {
        setValue(previous);
        alert(error instanceof Error ? error.message : "Failed to update stage");
      }
    });
  }

  return (
    <span className="inline-flex min-w-32">
      <Select
        aria-label={`Change stage for ${order.number}`}
        value={value}
        onChange={handleChange}
        disabled={isPending}
        className="h-8 min-w-32 rounded-full py-1 pl-4 pr-8 text-xs font-semibold"
        style={stageColorStyles(color)}
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </Select>
    </span>
  );
}

function describeStageEffect(effect: OrderStage["effect"]) {
  switch (effect) {
    case "commit":
      return "reserve stock for this order";
    case "release":
      return "release any reserved stock back to available";
    case "consume":
      return "remove items from inventory";
    case "mark_paid":
      return "mark the order as fully paid";
    default:
      return "update the order";
  }
}

function DailySalesCard({
  date,
  orderCount,
  total,
  currency,
}: {
  date: Date;
  orderCount: number;
  total: number;
  currency: string;
}) {
  return (
    <Card className="overflow-hidden border-sky-100 bg-gradient-to-r from-white via-sky-50/70 to-white shadow-card dark:border-cyan-900/40 dark:from-slate-950 dark:via-cyan-950/35 dark:to-slate-950">
      <div className="grid min-h-24 grid-cols-[minmax(0,1fr)_4.25rem_6.75rem] items-center gap-2 px-3 py-3 min-[430px]:grid-cols-[minmax(0,1fr)_4.75rem_7.75rem] min-[430px]:px-4 sm:grid-cols-[minmax(0,1fr)_8rem_10rem] sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 min-[430px]:gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 dark:border-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-200 sm:flex">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 text-[10px] font-medium uppercase text-sky-700 min-[430px]:text-xs dark:text-cyan-200/70">
              <CalendarDays className="h-3 w-3" />
              Date
            </div>
            <div className="mt-0.5 text-xs font-semibold leading-snug text-foreground sm:truncate sm:text-lg dark:text-white">
              {dailyDateFormatter.format(date)}
            </div>
          </div>
        </div>

        <div className="flex h-14 items-center justify-center rounded-md border border-sky-100 bg-white/70 px-1.5 text-center min-[430px]:px-3 sm:h-16 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="min-w-0">
            <div className="text-base font-semibold leading-none text-foreground min-[430px]:text-lg dark:text-white">
              {orderCount}
            </div>
            <div className="mt-1 truncate text-[10px] text-sky-700 min-[430px]:text-xs dark:text-cyan-200/70">
              {orderCount === 1 ? "order" : "orders"}
            </div>
          </div>
        </div>

        <div className="flex h-14 items-center justify-end rounded-md border border-sky-100 bg-white/70 px-2 text-right min-[430px]:px-3 sm:h-16 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-none text-foreground min-[430px]:text-lg dark:text-white">
              {formatMoney(total, currency)}
            </div>
            <div className="mt-1 truncate text-[10px] text-sky-700 min-[430px]:text-xs dark:text-cyan-200/70">
              Sales revenue
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CustomerDialogContent({ customer }: { customer: OrdersListRow }) {
  return (
    <DialogContent title="Customer information" className="max-w-lg">
      <div className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{customer.customerName}</h2>
            {customer.storeCode ? (
              <p className="mt-1 text-sm text-muted-foreground">{customer.storeCode}</p>
            ) : null}
          </div>
          <Badge variant={customer.customerIsActive === false ? "secondary" : "success"}>
            {customer.customerIsActive === false ? "Inactive" : "Active"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="Email" value={customer.customerEmail ?? "-"} />
          <InfoField label="Phone" value={customer.customerPhone ?? "-"} />
          <InfoField label="Payment terms" value={formatWords(customer.customerPaymentTerms)} />
          <InfoField label="Tax ID" value={customer.customerTaxId ?? "-"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="Billing address" value={formatAddress(customer.customerBillingAddress)} multiline />
          <InfoField
            label="Shipping address"
            value={formatAddress(customer.customerShippingAddress)}
            multiline
          />
        </div>

        {customer.customerNotes ? (
          <InfoField label="Notes" value={customer.customerNotes} multiline />
        ) : null}

        {customer.customerId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/customers/${customer.customerId}`}>Open customer profile</Link>
          </Button>
        ) : null}
      </div>
    </DialogContent>
  );
}

function InfoField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2.5">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm", multiline && "whitespace-pre-line")}>{value}</div>
    </div>
  );
}

function OrderCard({ columns, order }: { columns: Column[]; order: OrdersListRow }) {
  const headerColumns = columns.filter((column) => headerColumnIds.has(column.id));
  const detailColumns = columns.filter((column) => !headerColumnIds.has(column.id));
  const color = order.stageColor ?? "#cbd5e1";

  return (
    <Card
      className="overflow-hidden border-l-4"
      style={{ borderLeftColor: color }}
    >
      {headerColumns.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3 border-b bg-muted/30 px-3 py-2.5 md:grid-cols-[minmax(16rem,1fr)_8rem_8rem] md:px-4">
          {headerColumns.map((column) => (
            <div key={column.id} className="min-w-0 text-left">
              <div className="mb-1 truncate text-[11px] font-medium uppercase text-muted-foreground">
                {column.label}
              </div>
              <div className="min-w-0 text-left text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                {column.render(order)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {detailColumns.length > 0 ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-3 px-3 py-3 md:flex md:flex-nowrap md:px-4">
          {detailColumns.map((column) => (
            <div key={column.id} className="min-w-0 text-left md:flex-1">
              <div className="mb-1 truncate text-xs text-muted-foreground">{column.label}</div>
              <div className="min-w-0 text-left text-sm [overflow-wrap:anywhere]">
                {column.render(order)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
