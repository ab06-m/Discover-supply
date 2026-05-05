import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_MAIN_APP_URL = "http://localhost:3000";

export async function POST(request: Request) {
  const baseUrl = process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_MAIN_APP_URL ?? DEFAULT_MAIN_APP_URL;
  const response = await fetch(new URL("/api/store/orders", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await request.json().catch(() => ({}))),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
