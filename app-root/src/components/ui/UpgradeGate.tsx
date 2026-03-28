"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { usePlanContext } from "@/contexts/PlanContext";

type UpgradeGateProps = {
  feature: string;
  children: ReactNode;
};

const getFeatureBenefitText = (feature: string) => {
  const normalized = feature.trim().toLowerCase();
  if (normalized.includes("pdf")) {
    return "Raporları tek tıkla dışa aktararak paylaşımı hızlandırın.";
  }
  if (normalized.includes("otomasyon") || normalized.includes("automation")) {
    return "Bildirim ve e-posta akışlarını otomatikleştirerek operasyon yükünü azaltın.";
  }
  return "Premium ile daha hızlı ve hatasız operasyon akışı elde edin.";
};

export function UpgradeGate({ feature, children }: UpgradeGateProps) {
  const { plan } = usePlanContext();
  const [dismissed, setDismissed] = useState(false);

  if (plan === "premium" || dismissed) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none blur-[2px] opacity-45">{children}</div>

      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-indigo-300/35 bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="max-w-sm text-center">
          <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-indigo-300/40 bg-indigo-400/15">
            <Lock className="h-5 w-5 text-indigo-100" />
          </span>
          <p className="mt-3 text-base font-semibold text-white">Bu özellik Premium’a özel</p>
          <p className="mt-1 text-sm text-indigo-100">{feature}</p>
          <p className="mt-1 text-xs text-slate-300">{getFeatureBenefitText(feature)}</p>

          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-[0_0_22px_rgba(99,102,241,0.5)]"
            >
              Premium’a Geç
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-slate-300 underline underline-offset-4 transition hover:text-white"
            >
              Şimdi değil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
