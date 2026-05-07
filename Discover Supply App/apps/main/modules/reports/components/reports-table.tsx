"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportColumn } from "../catalog";

type Props = {
  reportId: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  currency: string;
  csvHref: string;
};

function storageKey(reportId: string) {
  return `discover-supply.reports.${reportId}.columns.v1`;
}

function formatNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)
    : "";
}

function formatMoney(value: unknown, currency: string) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(number)
    : "";
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatValue(value: unknown, column: ReportColumn, currency: string) {
  if (value == null || value === "") return "-";
  if (column.format === "money") return formatMoney(value, currency);
  if (column.format === "number") return formatNumber(value);
  if (column.format === "percent") return `${formatNumber(Number(value) * 100)}%`;
  if (column.format === "date") return formatDate(value);
  return String(value);
}

export function ReportsTable({ reportId, columns, rows, currency, csvHref }: Props) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => columns.map((column) => column.key));

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(reportId));
    const validKeys = new Set(columns.map((column) => column.key));
    if (!saved) {
      setVisibleKeys(columns.map((column) => column.key));
      return;
    }

    try {
      const parsed = JSON.parse(saved) as string[];
      const next = parsed.filter((key) => validKeys.has(key));
      setVisibleKeys(next.length ? next : columns.map((column) => column.key));
    } catch {
      setVisibleKeys(columns.map((column) => column.key));
    }
  }, [columns, reportId]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(reportId), JSON.stringify(visibleKeys));
  }, [reportId, visibleKeys]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleKeys.includes(column.key)),
    [columns, visibleKeys],
  );

  function toggleColumn(key: string) {
    setVisibleKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">{rows.length} rows</p>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DialogTrigger>
            <DialogContent title="Report columns" className="max-w-md">
              <div className="space-y-2 p-4">
                {columns.map((column) => (
                  <label
                    key={column.key}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <span>{column.label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={visibleKeys.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                  </label>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleKeys(columns.map((column) => column.key))}
                >
                  Show all
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" size="sm">
            <a href={csvHref}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.length ? (
          rows.map((row, index) => (
            <article key={index} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="grid gap-3">
                {visibleColumns.map((column) => (
                  <div key={column.key} className="grid grid-cols-[minmax(96px,42%)_1fr] gap-3 text-sm">
                    <dt className="text-muted-foreground">{column.label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">
                      {formatValue(row[column.key], column, currency)}
                    </dd>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            No rows found.
          </div>
        )}
      </div>

      <div className="hidden rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key}>{formatValue(row[column.key], column, currency)}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={visibleColumns.length}>
                  No rows found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
