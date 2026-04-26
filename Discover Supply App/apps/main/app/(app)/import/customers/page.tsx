"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importCustomers } from "@/modules/import/actions";
import type { CustomerImportRow, ImportResult } from "@/modules/import/types";

const PREVIEW_COLS: Array<{ key: keyof CustomerImportRow; label: string }> = [
  { key: "ID", label: "ID" },
  { key: "Name", label: "Name" },
  { key: "Phone", label: "Phone" },
  { key: "Email", label: "Email" },
  { key: "Address", label: "Address" },
  { key: "Notes", label: "Notes" },
];

export default function ImportCustomersPage() {
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
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
    Papa.parse<CustomerImportRow>(file, {
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
      const res = await importCustomers(rows);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const preview = rows.slice(0, 10);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/import" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a KyteApp customers CSV. Duplicates (by ID or name) are skipped automatically.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center cursor-pointer hover:border-primary/60 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
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
      </div>

      {parseError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm">
            Preview — first {preview.length} of {rows.length} rows
          </h2>
          <div className="overflow-x-auto rounded-md border">
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
                    <TableCell className="font-mono text-xs">{row.ID || "—"}</TableCell>
                    <TableCell className="font-medium">{row.Name}</TableCell>
                    <TableCell>{row.Phone || "—"}</TableCell>
                    <TableCell>{row.Email || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {row.Address || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {row.Notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > 10 && (
            <p className="text-xs text-muted-foreground">… and {rows.length - 10} more rows</p>
          )}
        </div>
      )}

      {rows.length > 0 && !result && (
        <Button onClick={handleImport} disabled={loading}>
          {loading ? "Importing…" : `Import ${rows.length} customers`}
        </Button>
      )}

      {result && (
        <div className="rounded-md border bg-background p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Import complete
          </div>
          <ul className="text-sm space-y-1">
            <li>
              <span className="font-medium text-green-700">{result.imported}</span> customer
              {result.imported === 1 ? "" : "s"} imported
            </li>
            <li className="text-muted-foreground">
              {result.skipped} skipped — already exist
            </li>
          </ul>
          {result.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
              <div className="flex items-center gap-1 font-medium">
                <XCircle className="h-4 w-4" />
                {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>… and {result.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
          <div className="flex gap-2 pt-1">
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
              <Link href="/customers">View customers</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
