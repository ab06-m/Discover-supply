"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny cart store — backed by localStorage so the cart survives refresh.
 * Scoped per org by prefixing the storage key.
 */

export type CartItem = {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  quantity: number;
};

type CartState = { items: CartItem[] };

const KEY = "ds-storefront-cart";
const listeners = new Set<() => void>();
let state: CartState = { items: [] };
let hydrated = false;

function load(): CartState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { items: [] };
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const l of listeners) l();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

export const cart = {
  get: () => {
    ensureHydrated();
    return state;
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  add: (item: Omit<CartItem, "quantity">, qty = 1) => {
    ensureHydrated();
    const existing = state.items.find((i) => i.productId === item.productId);
    state = existing
      ? {
          items: state.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i,
          ),
        }
      : { items: [...state.items, { ...item, quantity: qty }] };
    persist();
    emit();
  },
  setQty: (productId: string, qty: number) => {
    ensureHydrated();
    if (qty <= 0) {
      state = { items: state.items.filter((i) => i.productId !== productId) };
    } else {
      state = {
        items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
      };
    }
    persist();
    emit();
  },
  remove: (productId: string) => {
    ensureHydrated();
    state = { items: state.items.filter((i) => i.productId !== productId) };
    persist();
    emit();
  },
  clear: () => {
    state = { items: [] };
    persist();
    emit();
  },
};

export function useCart() {
  return useSyncExternalStore(
    cart.subscribe,
    () => cart.get(),
    () => ({ items: [] }),
  );
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}
