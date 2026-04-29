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
    <div className={cn("rounded-lg border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</div>
      {(trend || hint) && (
        <div className="mt-1.5 flex items-center gap-2">
          {trend ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                trend.positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {trend.value}
            </span>
          ) : null}
          {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
        </div>
      )}
    </div>
  );
}
