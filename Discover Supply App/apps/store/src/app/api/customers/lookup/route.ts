import { NextResponse } from "next/server";
import { getMainAppUrl } from "@/lib/products-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let baseUrl: string;
  try {
    baseUrl = getMainAppUrl();
  } catch {
    return NextResponse.json({ error: "Store is not configured." }, { status: 503 });
  }

  const response = await fetch(new URL("/api/store/customers/lookup", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await request.json().catch(() => ({}))),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
