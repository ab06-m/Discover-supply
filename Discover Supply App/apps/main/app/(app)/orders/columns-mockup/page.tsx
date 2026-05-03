import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { OrderColumnsMockup } from "@/modules/orders/components/order-columns-mockup";

export default function OrdersColumnsMockupPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders Column Mockup"
        subtitle="Preview only"
        backHref="/orders"
        backLabel="Orders"
        actions={<Badge variant="warning">Mockup</Badge>}
      />
      <OrderColumnsMockup />
    </div>
  );
}
