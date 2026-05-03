import { CalendarDays, DollarSign, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type DailySale = {
  date: Date;
  orderCount: number;
  total: number;
};

const rows: DailySale[] = [
  {
    date: new Date("2026-05-02T12:00:00"),
    orderCount: 4,
    total: 520,
  },
  {
    date: new Date("2026-05-01T12:00:00"),
    orderCount: 7,
    total: 893.5,
  },
  {
    date: new Date("2026-04-30T12:00:00"),
    orderCount: 3,
    total: 246.75,
  },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function DailySalesMockup() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Daily sales by date</h2>
          <p className="text-sm text-muted-foreground">Sorted newest to oldest</p>
        </div>
        <Badge variant="outline">Mockup</Badge>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <Card
            key={row.date.toISOString()}
            className="overflow-hidden border-cyan-900/40 bg-gradient-to-r from-slate-950 via-cyan-950/35 to-slate-950 shadow-card"
          >
            <div className="grid min-h-24 grid-cols-[minmax(0,1fr)_4.25rem_6.75rem] items-center gap-2 px-3 py-3 min-[430px]:grid-cols-[minmax(0,1fr)_4.75rem_7.75rem] min-[430px]:px-4 sm:grid-cols-[minmax(0,1fr)_8rem_10rem] sm:gap-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-2 min-[430px]:gap-3">
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-400/10 text-cyan-200 sm:flex">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1 text-[10px] font-medium uppercase text-cyan-200/70 min-[430px]:text-xs">
                    <CalendarDays className="h-3 w-3" />
                    Date
                  </div>
                  <div className="mt-0.5 text-xs font-semibold leading-snug text-white sm:truncate sm:text-lg">
                    {formatDate(row.date)}
                  </div>
                </div>
              </div>

              <div className="flex h-14 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 text-center min-[430px]:gap-2 min-[430px]:px-3 sm:h-16">
                <ShoppingCart className="hidden h-4 w-4 text-cyan-200/75 sm:block" />
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-none text-white min-[430px]:text-lg">
                    {row.orderCount}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-cyan-200/70 min-[430px]:text-xs">
                    {row.orderCount === 1 ? "order" : "orders"}
                  </div>
                </div>
              </div>

              <div className="flex h-14 items-center justify-end rounded-md border border-white/10 bg-white/[0.04] px-2 text-right min-[430px]:gap-2 min-[430px]:px-3 sm:h-16">
                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-slate-950 sm:flex">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold leading-none text-white min-[430px]:text-lg">
                      {formatMoney(row.total)}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-cyan-200/70 min-[430px]:text-xs">
                    Sales revenue
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
