"use client";

import { Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";

export function BuyerBrowseShell({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const isDark = mode === "dark";

  return (
    <div className="buyer-mockup-page" data-mode={mode}>
      <button
        type="button"
        className="buyer-theme-toggle"
        onClick={() => setMode(isDark ? "light" : "dark")}
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
        <span>{isDark ? "Light" : "Dark"}</span>
      </button>
      {children}
    </div>
  );
}
