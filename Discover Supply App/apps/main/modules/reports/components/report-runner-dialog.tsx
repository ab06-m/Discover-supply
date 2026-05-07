"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  title: string;
  closeHref: string;
  children: ReactNode;
};

export function ReportRunnerDialog({ title, closeHref, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [title]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      router.push(closeHref, { scroll: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={title}
        className="flex max-h-[calc(100vh-2rem)] max-w-[min(1180px,calc(100vw-1.5rem))] flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
