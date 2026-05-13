import { getCatalogOrg } from "@/lib/catalog-org";
import { listCatalog } from "@/modules/storefront/queries";
import { BuyerBrowseExperience } from "@/modules/storefront/components/buyer-browse-experience";

export const dynamic = "force-dynamic";

export default async function OnlineCatalogPage() {
  const org = await getCatalogOrg();
  const items = await listCatalog(org.id);

  return (
    <BuyerBrowseExperience
      items={items}
      currency={org.currency}
      pageContext={{ hasMorePage: false, total: items.length }}
    />
  );
}
