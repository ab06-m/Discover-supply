import { BarChart3, Boxes, Store } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";

const reports = [
  {
    title: "Sales report",
    description: "Track revenue, order volume, and store purchasing trends.",
    icon: BarChart3,
  },
  {
    title: "Inventory valuation",
    description: "Review stock-on-hand value and low-stock exposure.",
    icon: Boxes,
  },
  {
    title: "Customer activity",
    description: "Compare store order frequency, recency, and totals.",
    icon: Store,
  },
];

export default async function ReportsPage() {
  await requireActiveOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Analytics and insights for your organization." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title} className="shadow-card">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
