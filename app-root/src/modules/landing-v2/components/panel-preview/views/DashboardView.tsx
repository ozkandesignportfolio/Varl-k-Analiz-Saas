import { memo } from "react";
import {
  ArrowRight,
  CreditCard,
  Receipt,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";

/* ── static showcase data ────────────────────────────────── */

const ALERT = {
  icon: Wrench,
  title: "Klima B3 — Aylık filtre değişimi",
  badge: "2 gün gecikti",
};

const HERO_METRIC = {
  label: "Aktif Varlık",
  value: "148",
  context: "Son 30 günde 12 yeni kayıt eklendi",
  trend: "+8.4%",
};

const SUB_METRICS: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: "Bakım Kuralı", value: "26", icon: Wrench },
  { label: "Servis Gideri", value: "84.750 ₺", icon: TrendingUp },
];

const STATUS_ROW: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  { label: "Premium Plan", detail: "23 Mar 2026 yenileme", icon: CreditCard },
  { label: "Açık Fatura", detail: "3.420 ₺ · 24 Mar vade", icon: Receipt },
];

/* ── component ───────────────────────────────────────────── */

function DashboardViewInner(_props: PanelPreviewViewProps) {
  const AlertIcon = ALERT.icon;

  return (
    <>
      <div
        className="flex h-full flex-col px-3 pb-4 pt-2 md:px-8 md:pb-8 md:pt-4"
        style={{ animation: "dvFadeIn 220ms ease-out both" }}
      >
        {/* notification strip */}
        <div className="flex items-center gap-2.5 rounded-lg bg-rose-500/[0.06] px-3.5 py-2 md:gap-3 md:px-4 md:py-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
          <AlertIcon className="hidden size-3.5 text-rose-300/60 md:block" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-rose-200/80 md:text-xs">
            {ALERT.badge}
            <span className="mx-1.5 hidden text-[#8DA6C8]/30 md:inline" aria-hidden>
              ·
            </span>
            <span className="hidden text-[#9FB2CE]/70 md:inline">{ALERT.title}</span>
          </p>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-rose-300/50 md:text-[11px]">
            Görüntüle
          </span>
        </div>

        {/* primary metric — single dominant focus */}
        <div className="flex flex-1 flex-col items-center justify-center py-8 md:py-14">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8DA6C8]/50 md:text-[11px] md:tracking-[0.26em]">
            {HERO_METRIC.label}
          </p>

          <p className="mt-2.5 text-[3.25rem] font-semibold leading-none tracking-tight text-[#F8FAFC] md:mt-3 md:text-[4.5rem]">
            {HERO_METRIC.value}
          </p>

          <div className="mt-2.5 flex items-center gap-2 md:mt-3">
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" aria-hidden />
              {HERO_METRIC.trend}
            </span>
            <span className="hidden text-[11px] text-[#8DA6C8]/35 md:inline">{HERO_METRIC.context}</span>
          </div>

          {/* secondary metrics */}
          <div className="mt-8 flex gap-10 md:mt-12 md:gap-14">
            {SUB_METRICS.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="flex flex-col items-center">
                  <Icon className="mb-1.5 size-3.5 text-[#8DA6C8]/30" aria-hidden />
                  <p className="text-lg font-semibold tracking-tight text-[#E2ECFF]/90 md:text-xl">{m.value}</p>
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[#8DA6C8]/40 md:text-[10px]">
                    {m.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* combined status row — subscription + invoice in one section */}
        <div className="flex flex-col rounded-lg bg-white/[0.02] md:flex-row">
          {STATUS_ROW.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex flex-1 items-center gap-3 px-3.5 py-2.5 md:px-4 md:py-3${
                  i > 0 ? " border-t border-white/[0.03] md:border-l md:border-t-0" : ""
                }`}
              >
                <Icon className="size-3.5 shrink-0 text-[#8DA6C8]/30" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#E2ECFF]/80 md:text-xs">{item.label}</p>
                  <p className="hidden truncate text-[10px] text-[#8DA6C8]/40 md:block">{item.detail}</p>
                </div>
                <ArrowRight className="hidden size-3 text-[#8DA6C8]/20 md:block" aria-hidden />
              </div>
            );
          })}
        </div>
      </div>

      {/* keyframe — CSS-only, no library */}
      <style>{`@keyframes dvFadeIn{from{opacity:0;transform:scale(.98) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </>
  );
}

export const DashboardView = memo(DashboardViewInner);
DashboardView.displayName = "DashboardView";
