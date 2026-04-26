"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Search, ChevronRight, CheckCircle } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCustomer, mergeCustomers } from "@/modules/customers/actions";
import type { Customer } from "@/modules/customers/schema";

type CandidateSummary = {
  id: string;
  name: string;
  storeCode: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  isActive: boolean;
};

const FIELDS = [
  { key: "phone" as const, label: "Phone" },
  { key: "email" as const, label: "Email" },
  { key: "paymentTerms" as const, label: "Payment terms" },
  { key: "notes" as const, label: "Notes" },
  { key: "billingAddress" as const, label: "Billing address" },
  { key: "shippingAddress" as const, label: "Shipping address" },
];

type MergeField = (typeof FIELDS)[number]["key"];

function formatAddress(addr: Customer["billingAddress"]): string {
  if (!addr?.line1) return "—";
  return [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
}

function getFieldValue(c: Customer, field: MergeField): string {
  switch (field) {
    case "phone": return c.phone ?? "—";
    case "email": return c.email ?? "—";
    case "paymentTerms": return c.paymentTerms ?? "—";
    case "notes": return c.notes ? c.notes.slice(0, 80) + (c.notes.length > 80 ? "…" : "") : "—";
    case "billingAddress": return formatAddress(c.billingAddress);
    case "shippingAddress": return formatAddress(c.shippingAddress);
  }
}

function hasConflict(keep: Customer, merge: Customer, field: MergeField): boolean {
  const a = getFieldValue(keep, field);
  const b = getFieldValue(merge, field);
  return a !== "—" && b !== "—" && a !== b;
}

function onlyInMerge(keep: Customer, merge: Customer, field: MergeField): boolean {
  return getFieldValue(keep, field) === "—" && getFieldValue(merge, field) !== "—";
}

export function MergeDialog({
  current,
  candidates,
}: {
  current: Customer;
  candidates: CandidateSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "compare" | "done">("select");
  const [search, setSearch] = useState("");
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // true = use value from duplicate, false = keep value from current
  const [useFromMerge, setUseFromMerge] = useState<Record<MergeField, boolean>>({
    phone: false,
    email: false,
    paymentTerms: false,
    notes: false,
    billingAddress: false,
    shippingAddress: false,
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = candidates.filter(
    (c) =>
      c.id !== current.id &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.storeCode ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  async function handleSelect(candidate: CandidateSummary) {
    setLoadingId(candidate.id);
    const full = await fetchCustomer(candidate.id);
    setLoadingId(null);
    if (!full) return;
    setDuplicate(full);
    // Auto-toggle: if current lacks a field but duplicate has it, default to using duplicate's
    const auto: Record<MergeField, boolean> = {
      phone: false,
      email: false,
      paymentTerms: false,
      notes: false,
      billingAddress: false,
      shippingAddress: false,
    };
    for (const { key } of FIELDS) {
      if (onlyInMerge(current, full, key)) auto[key] = true;
    }
    setUseFromMerge(auto);
    setStep("compare");
  }

  function handleMerge() {
    if (!duplicate) return;
    setError("");
    startTransition(async () => {
      try {
        await mergeCustomers({ keepId: current.id, mergeId: duplicate.id, useFromMerge });
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Merge failed");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setStep("select");
      setSearch("");
      setDuplicate(null);
      setError("");
    }, 300);
    if (step === "done") router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitMerge className="mr-2 h-4 w-4" />
          Merge
        </Button>
      </DialogTrigger>

      <DialogContent title="Merge accounts">
        {/* ── Step 1: Select duplicate ── */}
        {step === "select" && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Search for the duplicate account to merge into{" "}
              <span className="font-medium text-foreground">{current.name}</span>. The duplicate
              will be deactivated; its orders and invoices will move to this account.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name, email, or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No matches</p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/60 transition-colors disabled:opacity-50"
                  disabled={loadingId === c.id}
                  onClick={() => handleSelect(c)}
                >
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[c.email, c.phone, c.storeCode].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Compare fields ── */}
        {step === "compare" && duplicate && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-secondary/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Keep</div>
                <div className="font-semibold text-sm">{current.name}</div>
              </div>
              <div className="rounded-md border bg-secondary/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Merge in → deactivate</div>
                <div className="font-semibold text-sm">{duplicate.name}</div>
              </div>
            </div>

            <div className="space-y-2">
              {FIELDS.map(({ key, label }) => {
                const keepVal = getFieldValue(current, key);
                const mergeVal = getFieldValue(duplicate, key);
                const conflict = hasConflict(current, duplicate, key);
                const onlyMerge = onlyInMerge(current, duplicate, key);
                if (keepVal === "—" && mergeVal === "—") return null;

                return (
                  <div key={key} className="rounded-md border p-3 space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">{label}</div>
                    {conflict ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-start gap-2 cursor-pointer rounded p-2 text-sm transition-colors ${!useFromMerge[key] ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary/60"}`}>
                          <input
                            type="radio"
                            className="mt-0.5 shrink-0"
                            checked={!useFromMerge[key]}
                            onChange={() => setUseFromMerge((p) => ({ ...p, [key]: false }))}
                          />
                          <span>{keepVal}</span>
                        </label>
                        <label className={`flex items-start gap-2 cursor-pointer rounded p-2 text-sm transition-colors ${useFromMerge[key] ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary/60"}`}>
                          <input
                            type="radio"
                            className="mt-0.5 shrink-0"
                            checked={useFromMerge[key]}
                            onChange={() => setUseFromMerge((p) => ({ ...p, [key]: true }))}
                          />
                          <span>{mergeVal}</span>
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className={onlyMerge ? "text-muted-foreground line-through" : ""}>
                          {onlyMerge ? "—" : keepVal}
                        </span>
                        {onlyMerge && (
                          <span className="text-foreground font-medium">{mergeVal} <span className="text-xs text-muted-foreground">(from duplicate)</span></span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={handleMerge} disabled={isPending}>
                {isPending ? "Merging…" : "Merge accounts"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <p className="font-semibold">Accounts merged</p>
              <p className="text-sm text-muted-foreground mt-1">
                All orders and invoices from the duplicate have been moved to this account.
              </p>
            </div>
            <DialogClose asChild>
              <Button onClick={() => router.refresh()}>Done</Button>
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
