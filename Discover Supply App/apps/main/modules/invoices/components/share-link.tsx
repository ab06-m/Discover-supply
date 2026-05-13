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
  const [copyFailed, setCopyFailed] = useState(false);
  const url = token ? `${baseUrl}/i/${token}` : null;

  function generate() {
    startTransition(async () => {
      const res = await createInvoiceShareLink(invoiceId);
      setToken(res.token);
    });
  }

  async function copy() {
    if (!url) return;
    setCopyFailed(false);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  if (!url) {
    return (
      <Button type="button" variant="outline" onClick={generate} disabled={isPending}>
        <Link2 className="mr-2 h-4 w-4" />
        {isPending ? "Generating..." : "Get share link"}
      </Button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="flex-1 rounded-md border border-input bg-muted px-2 py-1 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label="Copy link">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {copyFailed && (
        <p className="text-xs text-muted-foreground">
          Copy was blocked by the browser. Select the link and copy it manually.
        </p>
      )}
    </div>
  );
}
