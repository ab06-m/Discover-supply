export type ReportDatePreset = "ytd" | "mtd" | "last_30_days" | "last_week" | "last_month" | "custom";

export type DateRange = { start: Date; end: Date };

export const reportDatePresets: Array<{ value: ReportDatePreset; label: string }> = [
  { value: "ytd", label: "Year to date" },
  { value: "mtd", label: "Month to date" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_week", label: "Last 7 days" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

function baseDateAtUtcStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function isReportDatePreset(value?: string): value is ReportDatePreset {
  return reportDatePresets.some((preset) => preset.value === value);
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveReportDateRange(
  params: { preset?: string; start?: string; end?: string },
  now = new Date(),
): DateRange {
  const today = baseDateAtUtcStart(now);

  if (params.preset === "custom" && params.start && params.end) {
    return {
      start: new Date(`${params.start}T00:00:00.000Z`),
      end: new Date(`${params.end}T23:59:59.999Z`),
    };
  }

  if (params.preset === "last_week") {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start, end: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999)) };
  }

  if (params.preset === "last_month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
    return { start, end };
  }

  if (params.preset === "mtd") {
    return {
      start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      end: now,
    };
  }

  const preset = params.preset ?? "ytd";
  if (preset === "last_30_days") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 29);
    return { start, end: now };
  }

  return {
    start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
    end: now,
  };
}
