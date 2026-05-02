"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Folder, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryNode,
} from "../categories-actions";

type Props = {
  trigger: React.ReactNode;
};

type Mode = { kind: "create" } | { kind: "edit"; id: string };

// Builds an indented render order from the flat list using `parentId`. Each
// returned entry includes its depth so the rendering loop can pad-left the
// folder icon. Walking the tree iteratively (vs. recursive components) keeps
// the row markup flat — easier to style and key.
function flattenTree(nodes: CategoryNode[]): Array<CategoryNode & { depth: number }> {
  const childrenByParent = new Map<string | null, CategoryNode[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n);
    childrenByParent.set(n.parentId, list);
  }
  const result: Array<CategoryNode & { depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const k of kids) {
      result.push({ ...k, depth });
      walk(k.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

// Returns the set of ids that descend from `id` (inclusive), so the Parent
// dropdown can hide them while editing — picking a descendant as parent would
// create a cycle (the server also blocks this, but disabling the option is
// kinder to the user than waiting for the error).
function collectDescendants(nodes: CategoryNode[], id: string): Set<string> {
  const childrenByParent = new Map<string | null, CategoryNode[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n);
    childrenByParent.set(n.parentId, list);
  }
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const next = stack.pop()!;
    for (const child of childrenByParent.get(next) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

export function ManageCategoriesDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listCategories();
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  function resetForm() {
    setMode({ kind: "create" });
    setName("");
    setParentId("");
    setError(null);
  }

  function startEdit(node: CategoryNode) {
    setMode({ kind: "edit", id: node.id });
    setName(node.name);
    setParentId(node.parentId ?? "");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      try {
        if (mode.kind === "edit") {
          await updateCategory({ id: mode.id, name, parentId });
        } else {
          await createCategory({ name, parentId });
        }
        await refresh();
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save category.");
      }
    });
  }

  function handleDelete(node: CategoryNode) {
    const confirmed = window.confirm(
      `Delete "${node.name}"? Products in this category will become uncategorised; sub-categories move up one level.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteCategory({ id: node.id });
        if (mode.kind === "edit" && mode.id === node.id) resetForm();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete category.");
      }
    });
  }

  const tree = useMemo(() => flattenTree(items), [items]);
  const blockedParentIds = useMemo(
    () => (mode.kind === "edit" ? collectDescendants(items, mode.id) : new Set<string>()),
    [items, mode],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Manage Categories" className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3 border-b p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-destructive">
              Category Name*
            </Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-parent">Parent Category</Label>
            <select
              id="cat-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— None —</option>
              {tree
                .filter((n) => !blockedParentIds.has(n.id))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {" ".repeat(n.depth * 4)}
                    {n.name}
                  </option>
                ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </form>

        <div className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tree.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No categories yet. Add your first one above.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {tree.map((n) => {
                const isEditing = mode.kind === "edit" && mode.id === n.id;
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary"
                      style={{ paddingLeft: `${n.depth * 16}px` }}
                    >
                      {isEditing ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{n.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        className="rounded p-1 hover:bg-secondary hover:text-foreground"
                        aria-label={`Edit ${n.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(n)}
                        className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${n.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
