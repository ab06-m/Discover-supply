import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  className?: string;
};

export function StatCard({ label, value, hint, icon: Icon, trend, className }: Props) {
  return (
    <div className={cn("rounded-lg border bg-card p-5 shadow-card", className)}>
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {(trend || hint) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {trend ? (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 font-medium",
                trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {trend.value}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      )}
    </div>
  );
}
