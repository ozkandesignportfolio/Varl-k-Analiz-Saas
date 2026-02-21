"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AssetPreviewItem = {
  id: string;
  name: string;
  category: string;
};

type QuotaExceededModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetPreviewItem[];
  assetLimit: number;
};

export function QuotaExceededModal({ open, onOpenChange, assets, assetLimit }: QuotaExceededModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-300/35 bg-[#0E1525]">
        <DialogHeader className="text-left">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <DialogTitle className="pt-3 text-white">{assetLimit} varlık limitine ulaştınız</DialogTitle>
          <DialogDescription className="text-slate-300">
            Premium ile sınırsız varlık ekleyin
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mevcut Varlıklar</p>
          <ul className="mt-2 space-y-2">
            {assets.map((asset) => (
              <li key={asset.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-sm font-medium text-white">{asset.name}</p>
                <p className="text-xs text-slate-400">{asset.category}</p>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
          >
            Tamam
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-indigo-500 to-indigo-400 text-white hover:shadow-[0_0_22px_rgba(99,102,241,0.5)]"
          >
            <Link href="/pricing">Premium&apos;a Geç</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
