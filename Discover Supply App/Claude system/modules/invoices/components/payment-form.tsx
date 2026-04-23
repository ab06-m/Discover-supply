"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPayment } from "../actions";

type Props = {
  invoiceId: string;
  suggestedAmount: number;
};

export function PaymentForm({ invoiceId, suggestedAmount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await recordPayment({
          invoiceId,
          amount: Number(form.get("amount")),
          method: (form.get("method") as any) || "cash",
          reference: (form.get("reference") as string) || undefined,
          note: (form.get("note") as string) || undefined,
        });
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record payment");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={suggestedAmount > 0 ? suggestedAmount.toFixed(2) : ""}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" name="reference" placeholder="Check #, txn ID…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
