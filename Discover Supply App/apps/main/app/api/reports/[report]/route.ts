import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { reportIds } from "@/modules/reports/catalog";
import { runReport, type ReportFilters } from "@/modules/reports/engine";

export const dynamic = "force-dynamic";

const SUPPORTED = new Set(reportIds);

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { org } = await requireActiveOrg();
  const { report } = await params;

  if (!SUPPORTED.has(report)) {
    return NextResponse.json({ error: "Unsupported report" }, { status: 404 });
  }

  const url = new URL(request.url);
  const filters: ReportFilters = {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
    sku: url.searchParams.get("sku") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    customerId: url.searchParams.get("customerId") ?? undefined,
    page: numberParam(url.searchParams.get("page"), 1),
    pageSize: numberParam(url.searchParams.get("pageSize"), 50),
    inactivityDays: numberParam(url.searchParams.get("inactivityDays"), 60),
    sort: url.searchParams.get("sort") ?? undefined,
    direction: url.searchParams.get("direction") === "asc" ? "asc" : "desc",
  };
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const result = await runReport(org.id, report, filters, format);

  if (format === "csv") {
    return new NextResponse(result.body, {
      headers: {
        "content-type": result.contentType,
        "content-disposition": `attachment; filename=${report}.csv`,
      },
    });
  }

  return new NextResponse(result.body, { headers: { "content-type": result.contentType } });
}
