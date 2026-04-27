"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE_OPTIONS = [25, 50, 100, 250];

interface PaginationControlsProps {
  total: number;
  page: number;
  perPage: number;
}

export function PaginationControls({ total, page, perPage }: PaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      params.set(k, v);
    }
    return `${pathname}?${params.toString()}`;
  }

  function handlePerPageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildUrl({ per_page: e.target.value, page: "1" }));
  }

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const prevHref = buildUrl({ page: String(Math.max(1, page - 1)) });
  const nextHref = buildUrl({ page: String(Math.min(totalPages, page + 1)) });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? "No products" : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="per-page" className="text-sm text-muted-foreground whitespace-nowrap">
            Per page
          </label>
          <select
            id="per-page"
            value={perPage}
            onChange={handlePerPageChange}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? (
              <Link href={prevHref} prefetch>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}
          </Button>
          <span className="min-w-[4rem] text-center text-sm">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? (
              <Link href={nextHref} prefetch>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
