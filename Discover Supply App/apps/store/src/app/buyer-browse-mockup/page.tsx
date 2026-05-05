import { BuyerBrowseExperience } from "@/components/BuyerBrowseExperience";
import { getStoreProducts } from "@/lib/products-api";

export const dynamic = "force-dynamic";

export default async function BuyerBrowseMockup() {
  const { items, org, pageContext } = await getStoreProducts({ page: 1, limit: 48 });

  return <BuyerBrowseExperience items={items} currency={org.currency} pageContext={pageContext} />;
}
