/**
 * Default stage seed. When a new org is created we insert these so every tenant has
 * a working pipeline out of the box. Users can rename/reorder/add/remove.
 *
 * Business logic NEVER references stages by name — always by `slug` or `effect`.
 */

import type { StageEffect } from "../schema";

export type StageSeed = {
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  effect: StageEffect;
  isInitial?: boolean;
  isTerminal?: boolean;
};

export const DEFAULT_STAGES: StageSeed[] = [
  { slug: "draft", name: "Draft", color: "#94a3b8", sortOrder: 10, effect: "none", isInitial: true },
  { slug: "confirmed", name: "Confirmed", color: "#3b82f6", sortOrder: 20, effect: "commit" },
  { slug: "packed", name: "Packed", color: "#8b5cf6", sortOrder: 30, effect: "none" },
  { slug: "delivered", name: "Delivered", color: "#10b981", sortOrder: 40, effect: "consume" },
  { slug: "paid", name: "Paid", color: "#059669", sortOrder: 50, effect: "mark_paid", isTerminal: true },
  { slug: "cancelled", name: "Cancelled", color: "#ef4444", sortOrder: 99, effect: "release", isTerminal: true },
];
