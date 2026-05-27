"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
  /**
   * If true, keep scanning after each hit (for rapid sequential scans). If false (default),
   * the scanner closes after the first successful read.
   */
  continuous?: boolean;
};

/**
 * Phone-camera barcode scanner. Uses `@zxing/browser` under the hood.
 *
 * Works on any modern mobile browser (iOS Safari 14+, Android Chrome). When wrapped
 * in Capacitor we can swap this out for `@capacitor-mlkit/barcode-scanning` for a
 * faster native-path scan, but the UX of this component stays the same.
 */
export function BarcodeScanner({ open, onScan, onClose, continuous = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  // Store callbacks in refs to avoid restarting useEffect on parent re-renders
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastCode(null);

    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;

        controls = await reader.decodeFromVideoDevice(
          undefined, // let the browser pick; mobile defaults to rear camera
          video,
          (result, err, ctrl) => {
            if (cancelled) {
              ctrl.stop();
              return;
            }
            if (result) {
              const code = result.getText();
              setLastCode(code);
              onScanRef.current(code);
              if (!continuous) {
                ctrl.stop();
                onCloseRef.current();
              }
            }
            // ignore NotFoundException — zxing fires continuously while searching
          },
        );

        if (cancelled) {
          controls.stop();
        } else {
          stopRef.current = () => controls?.stop();
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Unable to start camera. Check browser permissions.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [open, continuous]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">Scan barcode</span>
        <button onClick={onClose} aria-label="Close scanner" className="rounded-md p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Targeting reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-full max-w-sm">
            <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-white" />
            <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-white" />
            <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-white" />
            <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-red-500/80" />
          </div>
        </div>
      </div>

      <div className="space-y-2 p-4 text-center text-white">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {lastCode && !error && continuous && (
          <p className="text-xs text-green-400">Scanned: {lastCode}</p>
        )}
        {!error && !lastCode && (
          <p className="text-xs text-white/60">Hold a barcode inside the frame.</p>
        )}
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small trigger button with a scan icon — use next to any product search input. */
export function BarcodeScanButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label="Scan barcode"
      title="Scan barcode"
    >
      <Barcode className="h-4 w-4" />
    </Button>
  );
}

export { RotateCcw };
