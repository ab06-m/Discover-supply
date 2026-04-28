"use client";

import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  color?: string | null;
};

type Props = {
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function StatusPill({ name, options, value, onChange, disabled, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary/5 text-primary"
                : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="sr-only"
            />
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                active ? "bg-primary" : "bg-muted-foreground/40",
              )}
              style={opt.color ? { backgroundColor: active ? opt.color : `${opt.color}60` } : undefined}
              aria-hidden="true"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
