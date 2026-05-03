"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  EyeOff,
  Grid3X3,
  GripVertical,
  PanelTop,
  RotateCcw,
  Settings2,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatMoney } from "@/lib/utils";

type Order = {
  id: string;
  number: string;
  store: string;
  storeCode?: string;
  stage: string;
  stageColor: string;
  date: string;
  total: number;
  delivery: string;
  salesRep: string;
  payment: string;
  items: number;
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
  | "items";

type Column = {
  id: ColumnId;
  label: string;
  align?: "right";
  render: (order: Order) => React.ReactNode;
};

type MobileLayout = "stacked" | "threeAcross" | "summary";

const orders: Order[] = [
  {
    id: "1",
    number: "SO-202605-0002",
    store: "Bruna Queiroz",
    storeCode: "BQ-104",
    stage: "Draft",
    stageColor: "#8fb3d9",
    date: "5/1/2026",
    total: 12.98,
    delivery: "Pickup",
    salesRep: "Mia Chen",
    payment: "Unpaid",
    items: 2,
  },
  {
    id: "2",
    number: "SO-202605-0001",
    store: "Northpoint Market",
    storeCode: "NP-011",
    stage: "Draft",
    stageColor: "#8fb3d9",
    date: "5/1/2026",
    total: 72.93,
    delivery: "Route A",
    salesRep: "Jules King",
    payment: "Deposit",
    items: 7,
  },
  {
    id: "3",
    number: "SO-202604-0038",
    store: "Canal Grocer",
    storeCode: "CG-204",
    stage: "Confirmed",
    stageColor: "#2f80ed",
    date: "4/27/2026",
    total: 6.99,
    delivery: "Route C",
    salesRep: "Mia Chen",
    payment: "Paid",
    items: 1,
  },
];

const columns: Column[] = [
  {
    id: "number",
    label: "Order",
    render: (order) => <span className="font-medium text-foreground">{order.number}</span>,
  },
  {
    id: "store",
    label: "Store",
    render: (order) => (
      <span className="space-y-0.5">
        <span className="block font-medium">{order.store}</span>
        {order.storeCode ? (
          <span className="block text-xs text-muted-foreground">{order.storeCode}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: "stage",
    label: "Stage",
    render: (order) => (
      <span
        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: order.stageColor }}
      >
        {order.stage}
      </span>
    ),
  },
  {
    id: "date",
    label: "Date",
    render: (order) => <span className="text-muted-foreground">{order.date}</span>,
  },
  {
    id: "total",
    label: "Total",
    align: "right",
    render: (order) => <span className="font-semibold">{formatMoney(order.total)}</span>,
  },
  {
    id: "delivery",
    label: "Delivery",
    render: (order) => <span>{order.delivery}</span>,
  },
  {
    id: "salesRep",
    label: "Sales rep",
    render: (order) => <span>{order.salesRep}</span>,
  },
  {
    id: "payment",
    label: "Payment",
    render: (order) => (
      <Badge
        variant={order.payment === "Paid" ? "success" : order.payment === "Deposit" ? "warning" : "secondary"}
      >
        {order.payment}
      </Badge>
    ),
  },
  {
    id: "items",
    label: "Items",
    align: "right",
    render: (order) => <span className="tabular-nums">{order.items}</span>,
  },
];

const defaultOrder: ColumnId[] = ["number", "store", "stage", "date", "total"];
const optionalOrder: ColumnId[] = ["delivery", "salesRep", "payment", "items"];
const allColumnIds = [...defaultOrder, ...optionalOrder];

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function OrderColumnsMockup() {
  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(allColumnIds);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<ColumnId>>(
    () => new Set(defaultOrder),
  );
  const [mobileLayout, setMobileLayout] = React.useState<MobileLayout>("stacked");

  const orderedColumns = columnOrder
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is Column => Boolean(column));

  const activeColumns = orderedColumns.filter((column) => visibleColumns.has(column.id));

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
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="self-start overflow-hidden">
        <CardHeader className="border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-primary" />
              Columns
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={resetColumns}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
        </CardContent>
      </Card>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Columns3 className="h-4 w-4 text-primary" />
            <span className="hidden md:inline">Desktop table</span>
            <Smartphone className="ml-2 h-4 w-4 text-primary md:hidden" />
            <span className="md:hidden">Mobile cards</span>
          </div>
          <Badge variant="outline">{activeColumns.length} visible</Badge>
        </div>

        <div className="grid gap-2 md:hidden">
          <MobileLayoutButton
            active={mobileLayout === "stacked"}
            icon={<Smartphone className="h-4 w-4" />}
            label="Option 1"
            description="Stacked fields"
            onClick={() => setMobileLayout("stacked")}
          />
          <MobileLayoutButton
            active={mobileLayout === "threeAcross"}
            icon={<Grid3X3 className="h-4 w-4" />}
            label="Option 2"
            description="3 fields per row"
            onClick={() => setMobileLayout("threeAcross")}
          />
          <MobileLayoutButton
            active={mobileLayout === "summary"}
            icon={<PanelTop className="h-4 w-4" />}
            label="Option 3"
            description="Summary header"
            onClick={() => setMobileLayout("summary")}
          />
        </div>

        <Card className="hidden overflow-hidden shadow-card md:block">
          {activeColumns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {activeColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(column.align === "right" && "text-right")}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    {activeColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(column.align === "right" && "text-right")}
                      >
                        {column.render(order)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyPreview />
          )}
        </Card>

        <MobileCardPreview layout={mobileLayout} columns={activeColumns} orders={orders} />
      </section>
    </div>
  );
}

function MobileLayoutButton({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          active ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-muted/40",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs">{description}</span>
      </span>
    </button>
  );
}

function MobileCardPreview({
  layout,
  columns,
  orders,
}: {
  layout: MobileLayout;
  columns: Column[];
  orders: Order[];
}) {
  if (columns.length === 0) {
    return (
      <div className="grid gap-3 md:hidden">
        <Card>
          <EmptyPreview />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:hidden">
      {orders.map((order) => {
        if (layout === "threeAcross") {
          return <ThreeAcrossMobileCard key={order.id} columns={columns} order={order} />;
        }

        if (layout === "summary") {
          return <SummaryMobileCard key={order.id} columns={columns} order={order} />;
        }

        return <StackedMobileCard key={order.id} columns={columns} order={order} />;
      })}
    </div>
  );
}

function StackedMobileCard({ columns, order }: { columns: Column[]; order: Order }) {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y">
        {columns.map((column, index) => (
          <div
            key={column.id}
            className={cn(
              "grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-3 text-sm",
              index === 0 && "bg-muted/30",
            )}
          >
            <div className="text-muted-foreground">{column.label}</div>
            <div className={cn("min-w-0", column.align === "right" && "text-right")}>
              {column.render(order)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ThreeAcrossMobileCard({ columns, order }: { columns: Column[]; order: Order }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-y">
        {columns.map((column) => (
          <div key={column.id} className="min-h-20 min-w-0 px-3 py-3">
            <div className="mb-1 truncate text-[11px] font-medium uppercase text-muted-foreground">
              {column.label}
            </div>
            <div
              className={cn(
                "min-w-0 text-sm leading-snug [overflow-wrap:anywhere]",
                column.align === "right" && "text-right",
              )}
            >
              {column.render(order)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SummaryMobileCard({ columns, order }: { columns: Column[]; order: Order }) {
  const headerIds = new Set<ColumnId>(["number", "stage", "date"]);
  const headerColumns = columns.filter((column) => headerIds.has(column.id));
  const detailColumns = columns.filter((column) => !headerIds.has(column.id));

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3 border-b bg-muted/30 px-3 py-2.5">
        {headerColumns.map((column) => (
          <div key={column.id} className="min-w-0">
            <div className="mb-1 truncate text-[11px] font-medium uppercase text-muted-foreground">
              {column.label}
            </div>
            <div className="min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
              {column.render(order)}
            </div>
          </div>
        ))}
      </div>
      {detailColumns.length > 0 ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-3 px-3 py-3">
          {detailColumns.map((column) => (
            <div key={column.id} className="min-w-0">
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

function EmptyPreview() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <EyeOff className="h-5 w-5" />
      <span>No visible columns</span>
    </div>
  );
}
