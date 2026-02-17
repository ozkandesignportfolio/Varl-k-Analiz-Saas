"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type QrScannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
};

type BarcodeLike = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

const formats = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
];

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const win = window as Window & { BarcodeDetector?: BarcodeDetectorCtor };
  return win.BarcodeDetector ?? null;
}

export function QrScannerModal({ isOpen, onClose, onDetected }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const [status, setStatus] = useState("Kamera başlatılıyor...");
  const [manualCode, setManualCode] = useState("");

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopAll();
    onClose();
  }, [onClose, stopAll]);

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      return;
    }

    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      const detector = detectorRef.current;

      if (video && detector && video.readyState >= 2) {
        try {
          const found = await detector.detect(video);
          const raw = found.find((item) => item.rawValue?.trim())?.rawValue?.trim();
          if (raw) {
            onDetected(raw);
            handleClose();
            return;
          }
        } catch {
          setStatus("Tarama sırasında geçici bir hata oluştu. Tekrar deneniyor...");
        }
      }

      timerRef.current = window.setTimeout(loop, 350);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Tarayıcı kamera erişimini desteklemiyor.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          setStatus("Video bileşeni başlatılamadı.");
          return;
        }

        video.srcObject = stream;
        await video.play();

        const Ctor = getBarcodeDetectorCtor();
        if (!Ctor) {
          setStatus("Bu tarayıcı barkod algılamayı desteklemiyor. Kodu alttan elle girebilirsiniz.");
          return;
        }

        detectorRef.current = new Ctor({ formats });
        setStatus("Kamerayı QR/Barkod üzerine tutun.");
        void loop();
      } catch {
        setStatus("Kamera açılamadı. İzinleri kontrol edin.");
      }
    };

    void start();

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onEsc);
      stopAll();
    };
  }, [handleClose, isOpen, onDetected, stopAll]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">QR / Barkod Tara</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Kapat
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-300">{status}</p>

        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted autoPlay />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Elle Kod Gir</p>
          <div className="flex gap-2">
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Örn: AC-1A2B3C4D5E"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={() => {
                const code = manualCode.trim();
                if (!code) return;
                onDetected(code);
                handleClose();
              }}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Git
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
