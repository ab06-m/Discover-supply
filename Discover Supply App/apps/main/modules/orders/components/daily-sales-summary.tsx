import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

type DailySalesRow = {
  createdAt: Date | string;
  total: string | number;
};

type DailySalesGroup = {
  key: string;
  date: Date;
  orderCount: number;
  total: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/New_York",
});

function moneyValue(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function buildGroups(rows: DailySalesRow[]) {
  const groups = new Map<string, DailySalesGroup>();

  for (const row of rows) {
    const date = typeof row.createdAt === "string" ? new Date(row.createdAt) : row.createdAt;
    const key = keyFormatter.format(date);
    const existing = groups.get(key);

    if (existing) {
      existing.orderCount += 1;
      existing.total += moneyValue(row.total);
    } else {
      groups.set(key, {
        key,
        date,
        orderCount: 1,
        total: moneyValue(row.total),
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export function DailySalesSummary({
  rows,
  currency,
}: {
  rows: DailySalesRow[];
  currency: string;
}) {
  const groups = buildGroups(rows);

  if (!groups.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Daily sales by date</h2>
        <p className="text-sm text-muted-foreground">Sorted newest to oldest</p>
      </div>

      <div className="grid gap-3">
        {groups.map((group) => (
          <Card
            key={group.key}
            className="overflow-hidden border-sky-100 bg-gradient-to-r from-white via-sky-50/70 to-white shadow-card dark:border-cyan-900/40 dark:from-slate-950 dark:via-cyan-950/35 dark:to-slate-950"
          >
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
                    {dateFormatter.format(group.date)}
                  </div>
                </div>
              </div>

              <div className="flex h-14 items-center justify-center rounded-md border border-sky-100 bg-white/70 px-1.5 text-center min-[430px]:px-3 sm:h-16 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-none text-foreground min-[430px]:text-lg dark:text-white">
                    {group.orderCount}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-sky-700 min-[430px]:text-xs dark:text-cyan-200/70">
                    {group.orderCount === 1 ? "order" : "orders"}
                  </div>
                </div>
              </div>

              <div className="flex h-14 items-center justify-end rounded-md border border-sky-100 bg-white/70 px-2 text-right min-[430px]:px-3 sm:h-16 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold leading-none text-foreground min-[430px]:text-lg dark:text-white">
                    {formatMoney(group.total, currency)}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-sky-700 min-[430px]:text-xs dark:text-cyan-200/70">
                    Sales revenue
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
