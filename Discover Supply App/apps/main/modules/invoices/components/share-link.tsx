"use client";

import { useState, useTransition } from "react";
import { Link2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvoiceShareLink } from "../actions";

type Props = {
  invoiceId: string;
  baseUrl: string;
  existingToken?: string | null;
};

export function ShareLinkButton({ invoiceId, baseUrl, existingToken }: Props) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [copied, setCopied] = useState(false);
  const url = token ? `${baseUrl}/i/${token}` : null;

  function generate() {
    startTransition(async () => {
      const res = await createInvoiceShareLink(invoiceId);
      setToken(res.token);
    });
  }

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!url) {
    return (
      <Button type="button" variant="outline" onClick={generate} disabled={isPending}>
        <Link2 className="mr-2 h-4 w-4" />
        {isPending ? "Generating…" : "Get share link"}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        onClick={(e) => (e.target as HTMLInputElement).select()}
        className="flex-1 rounded-md border border-input bg-muted px-2 py-1 text-xs"
      />
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
