import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabDef = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  tabs: TabDef[];
  activeId: string;
  /** Base pathname for tab links, e.g. "/settings" */
  basePath: string;
  /** Query param name to use. Defaults to "tab". */
  param?: string;
};

/**
 * Query-string-backed tab strip. Each tab is a real <Link>, so deep-links,
 * refreshes, and back/forward navigation all work without JS.
 */
export function TabNav({ tabs, activeId, basePath, param = "tab" }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={`${basePath}?${param}=${tab.id}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
