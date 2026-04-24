"use client";

import { useState, SyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ScanBarcode } from "lucide-react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");

  const handleSearch = (e: SyntheticEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("search", query.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1"); // Reset to page 1 on new search
    
    router.push(`/?${params.toString()}`);
  };

  const handleScan = () => {
    // Placeholder for barcode scanner modal
    alert("Barcode scanner will open here.");
  };

  return (
    <div className="search-container glass">
      <form onSubmit={handleSearch} className="search-form">
        <Search className="search-icon" size={20} />
        <input 
          type="text" 
          className="search-input" 
          placeholder="Search for products, categories, or SKUs..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="search-submit sr-only">Search</button>
      </form>
      <div className="search-divider"></div>
      <button type="button" className="scan-btn group" onClick={handleScan}>
        <ScanBarcode size={20} className="group-hover:text-accent transition-colors" />
        <span className="scan-text">Scan</span>
      </button>
    </div>
  );
}
