"use server";

import { requireActiveOrg } from "@/lib/auth";
import { listSellProductsPaginated } from "./queries";

export async function fetchSellProductsAction(opts: {
  query?: string;
  categoryId?: string;
  onlyAvailable?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { org } = await requireActiveOrg();
  return listSellProductsPaginated(org.id, opts);
}
