import { FolderTree } from "lucide-react";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, can, type Role } from "@/lib/permissions";
import { listProducts } from "@/modules/inventory/queries";
import { ReceiveForm } from "@/modules/inventory/components/receive-form";
import { CheckInItemForm } from "@/modules/inventory/components/check-in-item-form";
import { ManageCategoriesDialog } from "@/modules/inventory/components/manage-categories-dialog";
import { listCategories } from "@/modules/inventory/categories-actions";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "stock.receive");
  const { tab } = await searchParams;
  const activeTab = tab === "existing" ? "existing" : "new";
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);

  async function searchAction(query: string) {
    "use server";
    const { org: o, role: r } = await requireActiveOrg();
    assertCan(r as Role, "product.read");
    const rows = await listProducts(o.id, { search: query, limit: 10 });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      packSize: p.packSize,
      unit: p.unit,
      imageUrl: p.imageUrl,
    }));
  }

  const categories = await listCategories();
  const canManageCategories = can(role as Role, "category.write");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Check in"
        subtitle="Create a new item or receive stock for products already in inventory."
        actions={
          canManageCategories ? (
            <ManageCategoriesDialog
              trigger={
                <Button variant="outline">
                  <FolderTree className="mr-2 h-4 w-4" /> Manage categories
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm">
        <Link
          href="/check-in"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "new"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          New item
        </Link>
        <Link
          href="/check-in?tab=existing"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "existing"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          Existing stock
        </Link>
      </div>

      {activeTab === "new" ? (
        <CheckInItemForm
          categories={categories}
          defaultLowStockThreshold={defaultLowStockThreshold}
          currency={org.currency}
        />
      ) : (
        <div className="mx-auto max-w-3xl">
          <ReceiveForm searchAction={searchAction} />
        </div>
      )}
    </div>
  );
}
