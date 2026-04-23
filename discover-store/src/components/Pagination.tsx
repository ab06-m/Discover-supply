"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  perPage: number;
  hasMore: boolean;
}

export default function Pagination({ currentPage, perPage, hasMore }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    if (name === "limit") {
      params.set("page", "1"); // Reset to page 1 on limit change
    }
    return params.toString();
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/?${createQueryString("page", String(newPage))}`);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/?${createQueryString("limit", e.target.value)}`);
  };

  return (
    <div className="pagination-wrapper">
      <div className="pagination-controls">
        <label htmlFor="limit-select">Items per page:</label>
        <select
          id="limit-select"
          className="limit-select"
          value={perPage}
          onChange={handleLimitChange}
        >
          <option value="12">12</option>
          <option value="24">24</option>
          <option value="48">48</option>
          <option value="96">96</option>
        </select>
      </div>

      <div className="pagination-buttons">
        <button
          className="btn btn-outline"
          disabled={currentPage <= 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          <ChevronLeft size={16} />
          Prev
        </button>
        <span className="current-page">Page {currentPage}</span>
        <button
          className="btn btn-outline"
          disabled={!hasMore}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
