"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markDelivered } from "../actions";
import { SignaturePad } from "./signature-pad";
import { PhotoCapture } from "./photo-capture";

type Props = {
  dispatchId: string;
};

export function DeliverForm({ dispatchId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocError(null);
      },
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!recipient.trim()) {
      setError("Enter the recipient's name.");
      return;
    }
    if (!proof && !signature) {
      setError("Capture a photo or signature before marking delivered.");
      return;
    }
    startTransition(async () => {
      try {
        await markDelivered({
          dispatchId,
          recipientName: recipient,
          deliveryNotes: notes || undefined,
          latitude: coords?.lat,
          longitude: coords?.lng,
          proofImageDataUrl: proof ?? undefined,
          signatureDataUrl: signature ?? undefined,
        });
        router.push("/delivery?delivered=1");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark delivered");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="recipient">Received by</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Name of person who signed"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proof photo</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoCapture onChange={setProof} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad onChange={setSignature} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {coords ? (
            <div className="text-sm text-muted-foreground">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={captureLocation}>
              <MapPin className="mr-2 h-4 w-4" /> Capture GPS
            </Button>
          )}
          {locError && <p className="text-xs text-amber-600">{locError}</p>}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        <Check className="mr-2 h-4 w-4" />
        {isPending ? "Saving…" : "Mark delivered"}
      </Button>
    </form>
  );
}
