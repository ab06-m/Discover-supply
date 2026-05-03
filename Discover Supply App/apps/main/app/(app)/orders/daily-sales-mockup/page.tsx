import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { DailySalesMockup } from "@/modules/orders/components/daily-sales-mockup";

export default function DailySalesMockupPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Sales Mockup"
        subtitle="Preview only"
        backHref="/orders"
        backLabel="Orders"
        actions={<Badge variant="warning">Mockup</Badge>}
      />
      <DailySalesMockup />
    </div>
  );
}
