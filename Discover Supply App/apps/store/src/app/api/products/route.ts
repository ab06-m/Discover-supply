import { NextResponse } from "next/server";
import { getStoreProducts } from "@/lib/products-api";

export const dynamic = "force-dynamic";

function numberParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = numberParam(url.searchParams.get("page"), 1);
  const limit = numberParam(url.searchParams.get("limit"), 48);
  const search = url.searchParams.get("search")?.trim() || undefined;

  const products = await getStoreProducts({ page, limit, search });

  return NextResponse.json(products);
}
