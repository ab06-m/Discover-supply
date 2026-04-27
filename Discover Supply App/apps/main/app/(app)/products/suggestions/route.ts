import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { searchProductSuggestions } from "@/modules/inventory/queries";

export async function GET(req: NextRequest) {
  const { org } = await requireActiveOrg();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q) return NextResponse.json([]);

  const products = await searchProductSuggestions(org.id, q, 5);

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
    }))
  );
}
