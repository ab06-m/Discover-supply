import { requireActiveOrg } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getReportSnapshot, resolveDateRange } from "@/modules/reports/queries";

export const dynamic = "force-dynamic";

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; start?: string; end?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { preset, start, end } = await searchParams;
  const dateRange = resolveDateRange({ preset, start, end });
  const report = await getReportSnapshot(org.id, dateRange);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Sales, customers, products, geography, and inventory performance." />

      <form className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4 shadow-card">
        <div className="w-48">
          <label className="mb-1 block text-xs text-muted-foreground">Range</label>
          <Select name="preset" defaultValue={preset ?? "ytd"}>
            <option value="ytd">Year to date</option>
            <option value="mtd">Month to date</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="last_week">Last week</option>
            <option value="last_month">Last month</option>
            <option value="custom">Custom</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Start</label>
          <Input type="date" name="start" defaultValue={start ?? formatDateInput(dateRange.start)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">End</label>
          <Input type="date" name="end" defaultValue={end ?? formatDateInput(dateRange.end)} />
        </div>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardDescription>Revenue</CardDescription><CardTitle>{formatMoney(report.summary.revenue, org.currency)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Orders</CardDescription><CardTitle>{report.summary.orderCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Unique customers</CardDescription><CardTitle>{report.summary.uniqueCustomers}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Avg order value</CardDescription><CardTitle>{formatMoney(report.summary.avgOrder, org.currency)}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales by customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.salesByCustomer.map((row) => (
              <div key={`${row.customerId}-${row.customerName}`} className="flex items-center justify-between border-b pb-2">
                <div><p className="font-medium">{row.customerName}</p><p className="text-xs text-muted-foreground">{row.orderCount} orders</p></div>
                <p>{formatMoney(row.revenue, org.currency)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top products</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.topProducts.map((row) => (
              <div key={`${row.productId}-${row.productName}`} className="flex items-center justify-between border-b pb-2">
                <div><p className="font-medium">{row.productName}</p><p className="text-xs text-muted-foreground">{row.qtySold} units sold</p></div>
                <p>{formatMoney(row.revenue, org.currency)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sales by city</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.salesByCity.map((row) => (
              <div key={row.city} className="flex items-center justify-between border-b pb-2">
                <div><p className="font-medium">{row.city}</p><p className="text-xs text-muted-foreground">{row.orderCount} orders</p></div>
                <p>{formatMoney(row.revenue, org.currency)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inventory health</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center justify-between"><span>Active SKUs</span><span className="font-medium">{report.inventory.activeSkus}</span></p>
            <p className="flex items-center justify-between"><span>Inventory value</span><span className="font-medium">{formatMoney(report.inventory.inventoryValue, org.currency)}</span></p>
            <p className="flex items-center justify-between"><span>Low stock items</span><span className="font-medium">{report.inventory.lowStockCount}</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
