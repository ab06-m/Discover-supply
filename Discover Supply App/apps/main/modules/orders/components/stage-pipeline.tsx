"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { transitionOrderStage } from "../actions";
import type { OrderStage } from "../schema";

type Props = {
  orderId: string;
  currentStageId: string | null;
  stages: OrderStage[];
  canAdvance: boolean;
};

export function StagePipeline({ orderId, currentStageId, stages, canAdvance }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  const nonTerminal = stages.filter((s) => !s.isTerminal);
  const terminals = stages.filter((s) => s.isTerminal);

  function transition(toStageId: string, note?: string) {
    if (!canAdvance) return;
    const target = stages.find((s) => s.id === toStageId);
    if (!target) return;
    if (target.effect === "consume" || target.effect === "release" || target.isTerminal) {
      if (!confirm(`Move to “${target.name}”? This will ${describeEffect(target.effect)}.`)) return;
    }
    setError(null);
    setPendingStageId(toStageId);
    startTransition(async () => {
      try {
        await transitionOrderStage({ orderId, toStageId, note });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update stage");
      } finally {
        setPendingStageId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-2">
        {nonTerminal.map((s, i) => {
          const isCurrent = s.id === currentStageId;
          const isPast = currentIdx >= 0 && i < currentIdx && !stages[currentIdx]?.isTerminal;
          const isClickable = canAdvance && !isCurrent && !isPending;
          return (
            <li key={s.id} className="flex items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => transition(s.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  isCurrent
                    ? "text-white shadow-sm"
                    : isPast
                      ? "bg-muted text-muted-foreground"
                      : "bg-background hover:bg-secondary",
                  !isClickable && "cursor-default",
                )}
                style={isCurrent ? { backgroundColor: s.color, borderColor: s.color } : undefined}
                aria-current={isCurrent ? "step" : undefined}
              >
                {pendingStageId === s.id && isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isPast ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
                {s.name}
              </button>
              {i < nonTerminal.length - 1 && (
                <ChevronRight className="mx-0.5 h-4 w-4 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>

      {terminals.length > 0 && canAdvance && (
        <div className="flex flex-wrap gap-2">
          {terminals.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={s.id === currentStageId || isPending}
              onClick={() => transition(s.id)}
              style={s.id === currentStageId ? { borderColor: s.color, color: s.color } : undefined}
            >
              {pendingStageId === s.id && isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {s.name}
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function describeEffect(effect: OrderStage["effect"]) {
  switch (effect) {
    case "commit":
      return "reserve stock for this order";
    case "release":
      return "release any reserved stock back to available";
    case "consume":
      return "remove items from inventory (shipped)";
    case "mark_paid":
      return "mark the order as fully paid";
    default:
      return "update the order";
  }
}
