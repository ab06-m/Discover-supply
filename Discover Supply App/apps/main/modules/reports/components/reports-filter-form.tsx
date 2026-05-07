"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ReportDefinition } from "../catalog";
import {
  formatDateInput,
  isReportDatePreset,
  reportDatePresets,
  resolveReportDateRange,
  type ReportDatePreset,
} from "../date-ranges";

type CategoryOption = {
  id: string;
  name: string;
};

type CustomerOption = {
  id: string;
  name: string;
  storeCode: string | null;
};

type Props = {
  report: ReportDefinition;
  query: string;
  activeGroup: string;
  preset: ReportDatePreset;
  start: string;
  end: string;
  pageSize: number;
  inactivityDays: number;
  sort: string;
  direction: "asc" | "desc";
  sku?: string;
  categoryId?: string;
  customerId?: string;
  categories: CategoryOption[];
  customers: CustomerOption[];
};

export function ReportsFilterForm({
  report,
  query,
  activeGroup,
  preset: initialPreset,
  start: initialStart,
  end: initialEnd,
  pageSize,
  inactivityDays,
  sort,
  direction,
  sku,
  categoryId,
  customerId,
  categories,
  customers,
}: Props) {
  const [preset, setPreset] = useState<ReportDatePreset>(initialPreset);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const visibleFilters = new Set(report.filters);

  useEffect(() => {
    setPreset(initialPreset);
    setStart(initialStart);
    setEnd(initialEnd);
  }, [initialPreset, initialStart, initialEnd]);

  function handlePresetChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextPreset = event.target.value;
    if (!isReportDatePreset(nextPreset)) return;

    setPreset(nextPreset);
    if (nextPreset === "custom") return;

    const nextRange = resolveReportDateRange({ preset: nextPreset });
    setStart(formatDateInput(nextRange.start));
    setEnd(formatDateInput(nextRange.end));
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    setStart(event.target.value);
    setPreset("custom");
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>) {
    setEnd(event.target.value);
    setPreset("custom");
  }

  return (
    <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" action="/reports">
      <input type="hidden" name="report" value={report.id} />
      {query && <input type="hidden" name="q" value={query} />}
      {activeGroup !== "All" && <input type="hidden" name="group" value={activeGroup} />}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Range</label>
        <Select name="preset" value={preset} onChange={handlePresetChange}>
          {reportDatePresets.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Start</label>
        <Input type="date" name="start" value={start} onChange={handleStartChange} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">End</label>
        <Input type="date" name="end" value={end} onChange={handleEndChange} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Rows</label>
        <Select name="pageSize" defaultValue={String(pageSize)}>
          <option value="25">25 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
          <option value="200">200 rows</option>
        </Select>
      </div>

      {visibleFilters.has("sku") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">SKU or product</label>
          <Input name="sku" defaultValue={sku ?? ""} placeholder="Search SKU or product" />
        </div>
      )}
      {visibleFilters.has("categoryId") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <Select name="categoryId" defaultValue={categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {visibleFilters.has("customerId") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
          <Select name="customerId" defaultValue={customerId ?? ""}>
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.storeCode ? `${customer.storeCode} - ` : ""}
                {customer.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {visibleFilters.has("inactivityDays") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Inactive days</label>
          <Input type="number" min={0} name="inactivityDays" defaultValue={String(inactivityDays)} />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Sort</label>
        <Select name="sort" defaultValue={sort}>
          {report.sortOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Direction</label>
        <Select name="direction" defaultValue={direction}>
          <option value="desc">High to low</option>
          <option value="asc">Low to high</option>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full gap-2">
          <Filter className="h-4 w-4" />
          Run Report
        </Button>
      </div>
    </form>
  );
}
