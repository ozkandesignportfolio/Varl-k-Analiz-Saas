"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo } from "react";
import { AlertTriangle, ChevronDown, Clock3, Plus, ShieldAlert, ShieldCheck, Wrench, X } from "lucide-react";
import { DateRangeSelector } from "@/features/dashboard/components/DateRangeSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type DashboardDateRangeDays,
  type DashboardSystemRiskType,
  type DashboardSystemStatus,
} from "@/features/dashboard/api/dashboard-shared";
import { useRiskActions } from "@/features/dashboard/hooks/useRiskActions";

type ControlCenterHeaderProps = {
  userId: string;
  selectedRange: DashboardDateRangeDays;
  status: DashboardSystemStatus;
};

const SNOOZE_OPTIONS: { label: string; durationMs: number }[] = [
  { label: "1 saat", durationMs: 60 * 60 * 1000 },
  { label: "1 gün", durationMs: 24 * 60 * 60 * 1000 },
  { label: "1 hafta", durationMs: 7 * 24 * 60 * 60 * 1000 },
];

const RISK_FIX_ROUTES: Record<DashboardSystemRiskType, string> = {
  maintenance_due: "/maintenance",
  rule_missing: "/maintenance",
  document_missing: "/documents",
  invoice_due: "/billing",
  notification_prefs: "/settings",
};

const STATUS_STYLES: Record<
  DashboardSystemStatus["tone"],
  {
    wrapper: string;
    dot: string;
    badge: string;
    iconButton: string;
  }
> = {
  stable: {
    wrapper: "border-[#334155] bg-[#0F172A]/80",
    dot: "bg-slate-400",
    badge: "border-[#334155] bg-[#0B1221] text-[#94A3B8]",
    iconButton: "border-[#334155] bg-[#0B1221] text-[#C3D0E3] hover:bg-[#121C31]",
  },
  healthy: {
    wrapper: "border-emerald-300/35 bg-emerald-300/10",
    dot: "bg-emerald-400",
    badge: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
    iconButton: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20",
  },
  warning: {
    wrapper: "border-amber-300/35 bg-amber-300/10",
    dot: "bg-amber-300",
    badge: "border-amber-300/40 bg-amber-300/10 text-amber-100",
    iconButton: "border-amber-300/40 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20",
  },
  critical: {
    wrapper: "border-rose-300/35 bg-rose-300/12",
    dot: "bg-rose-400",
    badge: "border-rose-300/40 bg-rose-300/10 text-rose-100",
    iconButton: "border-rose-300/40 bg-rose-300/10 text-rose-100 hover:bg-rose-300/20",
  },
};

export const ControlCenterHeader = memo(function ControlCenterHeader({
  userId,
  selectedRange,
  status,
}: ControlCenterHeaderProps) {
  const router = useRouter();
  const style = STATUS_STYLES[status.tone];
  const { isStatusCardVisible, dismissRisk, snoozeRisk, markRiskFix } = useRiskActions({
    userId,
    riskKey: status.risk.riskKey,
  });

  const handleFix = useCallback(() => {
    markRiskFix();
    router.push(RISK_FIX_ROUTES[status.risk.type]);
  }, [markRiskFix, router, status.risk.type]);

  return (
    <section className="rounded-3xl border border-[#24344F] bg-[linear-gradient(145deg,rgba(8,20,45,0.92),rgba(9,17,33,0.84))] p-5 shadow-[0_20px_45px_rgba(3,8,20,0.42)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#314B6D] bg-[#0E2039]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200">
              <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="size-4" />
              Assetly OS
            </p>
            <span className="inline-flex items-center rounded-full border border-[#29425F] bg-[#0B1730]/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FA6C7]">
              Kontrol Merkezi
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">Kontrol Merkezi</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9FB2CE]">
              Tüm sistemi tek ekrandan yönetin: riskleri izleyin, hızlı aksiyon alın ve kritik alanları takip edin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector selectedRange={selectedRange} />

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#2F4569] bg-[#10243F] px-4 py-2 text-sm font-semibold text-[#E2E8F0] transition hover:bg-[#143158]">
              <Plus className="size-4" aria-hidden />
              Hızlı Ekle
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-xl border border-[#2B3E5B] bg-[#0A162A]/95 p-1.5 shadow-[0_16px_30px_rgba(2,8,20,0.5)] backdrop-blur">
              <HeaderDropdownLink href="/assets" label="Varlık Ekle" />
              <HeaderDropdownLink href="/maintenance" label="Bakım Kuralı Oluştur" />
              <HeaderDropdownLink href="/services" label="Servis Kaydı Ekle" />
              <HeaderDropdownLink href="/documents" label="Belge Yükle" />
            </div>
          </details>
        </div>
      </div>

      {isStatusCardVisible ? (
        <StatusAlertCard style={style} status={status} onDismiss={dismissRisk} onSnooze={snoozeRisk} onFix={handleFix} />
      ) : null}
    </section>
  );
});

const TONE_SEVERITY_LABEL: Record<DashboardSystemStatus["tone"], string> = {
  critical: "Kritik",
  warning: "Uyarı",
  stable: "Stabil",
  healthy: "Sağlıklı",
};

const TONE_SEVERITY_ICON: Record<DashboardSystemStatus["tone"], typeof ShieldAlert> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  stable: ShieldCheck,
  healthy: ShieldCheck,
};

const RISK_IMPACT: Record<DashboardSystemRiskType, string> = {
  maintenance_due: "Geciken veya planlanan bakımlar arıza riskini artırır ve onarım maliyetlerini yükseltebilir.",
  rule_missing: "Bakım kuralı olmadan varlıklardaki sorunlar fark edilemez ve maliyetli arızalara yol açabilir.",
  document_missing: "Eksik belgeler garanti, sigorta veya denetim süreçlerinde sorun yaratabilir.",
  invoice_due: "Geciken ödemeler ek ücret veya hizmet kesintisine neden olabilir.",
  notification_prefs: "Bildirim tercihlerinizi ayarlayarak önemli uyarıları kaçırmayın.",
};

const RISK_ACTION_LABEL: Record<DashboardSystemRiskType, string> = {
  maintenance_due: "Bakım Planla",
  rule_missing: "Kural Oluştur",
  document_missing: "Belge Yükle",
  invoice_due: "Ödeme Durumunu Kontrol Et",
  notification_prefs: "Tercihleri Düzenle",
};

const StatusAlertCard = memo(function StatusAlertCard({
  style,
  status,
  onDismiss,
  onSnooze,
  onFix,
}: {
  style: {
    wrapper: string;
    dot: string;
    badge: string;
    iconButton: string;
  };
  status: DashboardSystemStatus;
  onDismiss: () => void;
  onSnooze: (durationMs: number) => void;
  onFix: () => void;
}) {
  const SeverityIcon = useMemo(() => TONE_SEVERITY_ICON[status.tone], [status.tone]);
  const severityLabel = TONE_SEVERITY_LABEL[status.tone];
  const impact = RISK_IMPACT[status.risk.type];
  const fixLabel = RISK_ACTION_LABEL[status.risk.type];

  return (
    <div className={`mt-5 rounded-2xl border p-4 ${style.wrapper}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="mt-1 inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5">
            <SeverityIcon className="size-4 text-[#F8FAFC]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[#90A6C4]">Sistem Durumu</p>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                {severityLabel}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">{status.headline}</h2>
            <p className="mt-1 text-sm text-[#CBD5E1]">{status.detail}</p>
            {impact ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-amber-200/80">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400/70" aria-hidden />
                {impact}
              </p>
            ) : null}
          </div>
        </div>

        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex h-fit rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
              {status.riskCount} aktif kayıt
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                  aria-label="Görmezden gel"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Görmezden gel</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                      aria-label="Sonra hatırlat"
                    >
                      <Clock3 className="size-3.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sonra hatırlat</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-40 border-[#2F4569] bg-[#0D1F39]/95 text-[#E5EEFC] shadow-[0_14px_30px_rgba(2,8,20,0.5)]"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-[0.14em] text-[#9BB0CD]">
                  Sonra hatırlat
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#314B6D]" />
                {SNOOZE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onSelect={() => onSnooze(option.durationMs)}
                    className="cursor-pointer rounded-md text-sm text-[#E5EEFC] focus:bg-[#17345D] focus:text-white"
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={onFix}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${style.iconButton}`}
            >
              <Wrench className="size-3.5" aria-hidden />
              {fixLabel}
            </button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
});

function HeaderDropdownLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm text-[#D7E3F7] transition hover:border-[#3A557A] hover:bg-[#122643]"
    >
      <span>{label}</span>
      <span className="text-xs text-[#8FA6C7]">Git</span>
    </Link>
  );
}
