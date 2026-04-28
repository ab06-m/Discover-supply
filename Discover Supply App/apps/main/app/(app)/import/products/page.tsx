"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { importProducts } from "@/modules/import/actions";
import type { ImportResult, ProductImportRow } from "@/modules/import/types";

const PREVIEW_COLS: Array<{ key: keyof ProductImportRow; label: string }> = [
  { key: "Code", label: "Barcode" },
  { key: "Name", label: "Name" },
  { key: "Category", label: "Category" },
  { key: "Unit", label: "Unit" },
  { key: "Current Stock", label: "Stock" },
  { key: "Minimum Stock", label: "Min stock" },
  { key: "Cost", label: "Cost" },
  { key: "Price", label: "Price" },
];

export default function ImportProductsPage() {
  const [rows, setRows] = useState<ProductImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setResult(null);
    setParseError("");
    setRows([]);
    setFileName(file.name);
    Papa.parse<ProductImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        setRows(results.data);
      },
      error(err) {
        setParseError(err.message);
      },
    });
  }

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await importProducts(rows);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const preview = rows.slice(0, 10);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Import products"
        subtitle="Upload a KyteApp products CSV. Duplicates by barcode or name are skipped automatically."
        backHref="/import"
        backLabel="Import"
      />

      <Card
        className="flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-10 text-center shadow-card transition hover:border-primary"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <div>
          <p className="font-medium">{fileName || "Click or drag a CSV file here"}</p>
          <p className="text-sm text-muted-foreground">
            {rows.length > 0 ? `${rows.length} rows parsed` : "Accepts .csv exported from KyteApp"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </Card>

      {parseError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {parseError}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Product images reference local file paths and cannot be imported automatically. Add
            images individually from each product edit page after import.
          </span>
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Preview - first {preview.length} of {rows.length} rows
          </h2>
          <Card className="overflow-x-auto shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {PREVIEW_COLS.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{row.Code || "-"}</TableCell>
                    <TableCell className="font-medium">{row.Name}</TableCell>
                    <TableCell>{row.Category || "-"}</TableCell>
                    <TableCell>{row.Unit || "-"}</TableCell>
                    <TableCell className="text-right">{row["Current Stock"] || "0"}</TableCell>
                    <TableCell className="text-right">{row["Minimum Stock"] || "0"}</TableCell>
                    <TableCell className="text-right">{row.Cost || "0"}</TableCell>
                    <TableCell className="text-right">{row.Price || "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {rows.length > 10 && (
            <p className="text-xs text-muted-foreground">... and {rows.length - 10} more rows</p>
          )}
        </div>
      )}

      {rows.length > 0 && !result && (
        <Button onClick={handleImport} disabled={loading}>
          {loading ? "Importing..." : `Import ${rows.length} products`}
        </Button>
      )}

      {result && (
        <Card className="space-y-3 p-4 shadow-card">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-success" />
            Import complete
          </div>
          <ul className="space-y-1 text-sm">
            <li>
              <span className="font-medium text-success">{result.imported}</span> product
              {result.imported === 1 ? "" : "s"} imported
            </li>
            <li className="text-muted-foreground">
              {result.skipped} skipped - already exist in inventory
            </li>
          </ul>
          {result.errors.length > 0 && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-center gap-1 font-medium">
                <XCircle className="h-4 w-4" />
                {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 && <li>... and {result.errors.length - 10} more</li>}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => {
                setRows([]);
                setFileName("");
                setResult(null);
              }}
            >
              Import another file
            </Button>
            <Button asChild>
              <Link href="/products">View inventory</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
