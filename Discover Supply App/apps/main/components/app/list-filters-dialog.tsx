"use client";

import * as React from "react";
import { CalendarDays, Check, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PresetId =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  title: string;
  basePath: string;
  query?: string;
  preset?: string;
  from?: string;
  to?: string;
  selectName: string;
  selectLabel: string;
  selectValue?: string;
  selectAllLabel: string;
  selectOptions: SelectOption[];
};

const PRESET_OPTIONS: Array<{ value: PresetId; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const next = new Date(date);
  next.setDate(date.getDate() + diff);
  return next;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const next = new Date(start);
  next.setDate(start.getDate() + 6);
  return next;
}

function resolvePresetDates(preset: PresetId) {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (preset === "today") {
    return { from: formatDateInput(current), to: formatDateInput(current) };
  }

  if (preset === "yesterday") {
    const d = new Date(current);
    d.setDate(d.getDate() - 1);
    return { from: formatDateInput(d), to: formatDateInput(d) };
  }

  if (preset === "last_7_days") {
    const from = new Date(current);
    from.setDate(from.getDate() - 6);
    return { from: formatDateInput(from), to: formatDateInput(current) };
  }

  if (preset === "last_30_days") {
    const from = new Date(current);
    from.setDate(from.getDate() - 29);
    return { from: formatDateInput(from), to: formatDateInput(current) };
  }

  if (preset === "this_week") {
    return { from: formatDateInput(startOfWeek(current)), to: formatDateInput(current) };
  }

  if (preset === "last_week") {
    const thisWeekStart = startOfWeek(current);
    const to = new Date(thisWeekStart);
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    return { from: formatDateInput(from), to: formatDateInput(to) };
  }

  if (preset === "this_month") {
    const from = new Date(current.getFullYear(), current.getMonth(), 1);
    return { from: formatDateInput(from), to: formatDateInput(current) };
  }

  if (preset === "last_month") {
    const from = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const to = new Date(current.getFullYear(), current.getMonth(), 0);
    return { from: formatDateInput(from), to: formatDateInput(to) };
  }

  if (preset === "this_year") {
    const from = new Date(current.getFullYear(), 0, 1);
    return { from: formatDateInput(from), to: formatDateInput(current) };
  }

  const from = new Date(current.getFullYear() - 1, 0, 1);
  const to = new Date(current.getFullYear() - 1, 11, 31);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function countActiveFilters(params: {
  from?: string;
  to?: string;
  preset?: string;
  selectValue?: string;
}) {
  let count = 0;
  if (params.selectValue) count += 1;
  if (params.from || params.to || params.preset) count += 1;
  return count;
}

export function ListFiltersDialog({
  title,
  basePath,
  query,
  preset,
  from,
  to,
  selectName,
  selectLabel,
  selectValue,
  selectAllLabel,
  selectOptions,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [draftPreset, setDraftPreset] = React.useState<PresetId>((preset as PresetId) || "last_30_days");
  const [draftFrom, setDraftFrom] = React.useState(from ?? "");
  const [draftTo, setDraftTo] = React.useState(to ?? "");
  const [draftSelectValue, setDraftSelectValue] = React.useState(selectValue ?? "");

  React.useEffect(() => {
    setDraftPreset((preset as PresetId) || "last_30_days");
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
    setDraftSelectValue(selectValue ?? "");
  }, [from, preset, selectValue, to]);

  const activeFilters = countActiveFilters({
    from,
    to,
    preset,
    selectValue,
  });

  function setPreset(value: PresetId) {
    setDraftPreset(value);
    const range = resolvePresetDates(value);
    setDraftFrom(range.from);
    setDraftTo(range.to);
  }

  function clearDraft() {
    setDraftPreset("custom");
    setDraftFrom("");
    setDraftTo("");
    setDraftSelectValue("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters > 0 ? <Badge variant="secondary">{activeFilters}</Badge> : null}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} className="max-w-xl">
        <form action={basePath} className="space-y-4 p-4">
          {query ? <input type="hidden" name="q" value={query} /> : null}

          <div>
            <div className="mb-2 text-sm font-medium">Period</div>
            <input type="hidden" name="preset" value={draftPreset} />
            <div className="grid grid-cols-2 gap-2">
              {PRESET_OPTIONS.map((option) => {
                const selected = draftPreset === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreset(option.value)}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    <span>{option.label}</span>
                    {selected ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded-sm border" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Start</label>
              <Input
                type="date"
                name="from"
                value={draftFrom}
                onChange={(event) => {
                  setDraftFrom(event.target.value);
                  setDraftPreset("custom");
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">End</label>
              <Input
                type="date"
                name="to"
                value={draftTo}
                onChange={(event) => {
                  setDraftTo(event.target.value);
                  setDraftPreset("custom");
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{selectLabel}</label>
            <Select
              name={selectName}
              value={draftSelectValue}
              onChange={(event) => setDraftSelectValue(event.target.value)}
            >
              <option value="">{selectAllLabel}</option>
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={clearDraft} className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Clear all
            </Button>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Apply</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
