"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { buildAssetQrPayload } from "@/lib/assets/qr-payload";

type QrPreviewAsset = {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  qr_code: string | null;
};

type AssetQrPreviewModalProps = {
  asset: QrPreviewAsset | null;
  isOpen: boolean;
  onClose: () => void;
};

export function AssetQrPreviewModal({ asset, isOpen, onClose }: AssetQrPreviewModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [payload, setPayload] = useState("");

  useEffect(() => {
    if (!isOpen || !asset) return;

    const nextPayload =
      asset.qr_code?.trim() ||
      buildAssetQrPayload({
        assetId: asset.id,
        name: asset.name,
        category: asset.category,
        serialNumber: asset.serial_number,
        brand: asset.brand,
        model: asset.model,
      });

    let isCancelled = false;

    const load = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(nextPayload, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 320,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });

        if (isCancelled) return;
        setPayload(nextPayload);
        setQrDataUrl(dataUrl);
      } catch {
        if (isCancelled) return;
        setPayload(nextPayload);
        setQrDataUrl("");
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Varlık QR</h2>
            <p className="mt-1 text-sm text-slate-300">{asset.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 bg-white/5 p-2 text-slate-100 hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-white p-3">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`${asset.name} QR`}
              width={320}
              height={320}
              unoptimized
              className="mx-auto h-64 w-64 object-contain"
            />
          ) : (
            <p className="py-12 text-center text-sm text-slate-600">QR oluşturulamadı.</p>
          )}
        </div>

        <p className="mt-3 rounded-lg border border-white/12 bg-slate-900/70 p-2 text-xs text-slate-300">
          {payload || "QR payload hazırlanıyor..."}
        </p>
      </div>
    </div>
  );
}
