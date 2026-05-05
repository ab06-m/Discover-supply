import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { ProductCardMockups } from "@/modules/inventory/components/product-card-mockups";

export default function ProductCardMockupsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory card mockups"
        subtitle="Two product image layouts for the inventory list"
        backHref="/products"
        backLabel="Inventory"
        actions={<Badge variant="warning">Mockup</Badge>}
      />
      <ProductCardMockups />
    </div>
  );
}
