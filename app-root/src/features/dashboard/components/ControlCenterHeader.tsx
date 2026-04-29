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

type AlertContent = {
  severityLabel: string;
  title: string;
  description: string;
  impact: string;
  action: string;
  ctaLabel: string;
  SeverityIcon: typeof ShieldAlert;
};

const buildAlertContent = (status: DashboardSystemStatus): AlertContent => {
  const count = status.riskCount;

  switch (status.risk.type) {
    case "maintenance_due":
      return {
        severityLabel: status.tone === "critical" ? "Kritik" : "Uyarı",
        title: `${count} Bakım Zamanında Yapılmadı`,
        description:
          count === 1
            ? "Planlanan bakım tarihi geçmiş durumda. Gecikmiş bakım işlemini en kısa sürede planlayın."
            : `${count} varlık için planlanan bakım tarihleri geçmiş durumda. Gecikmiş işlemleri kontrol edin.`,
        impact: "Bakım gecikmesi arıza riskini artırır, performansı düşürür ve uzun vadede onarım maliyetlerini yükseltir.",
        action: "Bakım planını açarak gecikmiş işlemleri zamanlayın.",
        ctaLabel: "Bakımları Planla",
        SeverityIcon: ShieldAlert,
      };

    case "rule_missing":
      return {
        severityLabel: "Uyarı",
        title: "Bakım Kuralı Tanımlanmamış",
        description: "Varlıklarınız için henüz periyodik bakım kuralı oluşturulmamış.",
        impact: "Bakım kuralı olmadan olası arızalar önceden tespit edilemez ve plansız duruşlar yaşanabilir.",
        action: "En az bir periyodik bakım kuralı oluşturarak varlıklarınızı koruma altına alın.",
        ctaLabel: "Kural Oluştur",
        SeverityIcon: AlertTriangle,
      };

    case "document_missing":
      return {
        severityLabel: "Bilgi",
        title: `${count} Varlıkta Belge Eksik`,
        description:
          count === 1
            ? "Bir varlığa henüz hiç belge eklenmemiş."
            : `${count} varlığa henüz hiç belge eklenmemiş.`,
        impact: "Eksik belgeler garanti başvurusu, sigorta talebi veya denetim süreçlerinde ciddi sorun yaratabilir.",
        action: "İlgili varlıklara garanti belgesi, fatura veya servis raporlarını yükleyin.",
        ctaLabel: "Belge Yükle",
        SeverityIcon: AlertTriangle,
      };

    case "invoice_due":
      return {
        severityLabel: status.tone === "critical" ? "Kritik" : "Uyarı",
        title:
          status.tone === "critical"
            ? `${count} Ödeme Vadesi Geçti`
            : `${count} Ödeme Yaklaşıyor`,
        description:
          status.tone === "critical"
            ? `${count} faturanın ödeme tarihi geçmiş durumda. Gecikmiş ödemeleri hemen kontrol edin.`
            : `${count} faturanın ödeme tarihi yaklaşıyor. Zamanında ödeme yaparak gecikme riskinden kaçının.`,
        impact: "Geciken ödemeler ek ücret, faiz veya hizmet kesintisine neden olabilir.",
        action: "Fatura detaylarını kontrol edin ve ödeme planınızı güncelleyin.",
        ctaLabel: "Ödemeleri Kontrol Et",
        SeverityIcon: ShieldAlert,
      };

    case "notification_prefs":
    default:
      if (status.tone === "healthy") {
        return {
          severityLabel: "Sağlıklı",
          title: "Her Şey Yolunda",
          description: "Kritik veya yaklaşan risk kaydı bulunmuyor. Sisteminiz sağlıklı çalışıyor.",
          impact: "",
          action: "",
          ctaLabel: "Tercihleri Düzenle",
          SeverityIcon: ShieldCheck,
        };
      }
      return {
        severityLabel: "Bilgi",
        title: "Bildirim Tercihleri",
        description: "Bildirim ayarlarınızı düzenleyerek önemli uyarıları zamanında alın.",
        impact: "Doğru yapılandırılmamış bildirimler kritik uyarıların gözden kaçmasına yol açabilir.",
        action: "Bildirim tercihlerinizi kontrol edin ve güncelleyin.",
        ctaLabel: "Tercihleri Düzenle",
        SeverityIcon: ShieldCheck,
      };
  }
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
  const alert = useMemo(() => buildAlertContent(status), [status]);

  return (
    <div className={`mt-5 rounded-2xl border p-4 ${style.wrapper}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="mt-1 inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5">
            <alert.SeverityIcon className="size-4 text-[#F8FAFC]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                {alert.severityLabel}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                {status.riskCount} aktif kayıt
              </span>
            </div>

            <h2 className="text-lg font-semibold leading-snug text-[#F8FAFC]">{alert.title}</h2>
            <p className="text-sm leading-relaxed text-[#CBD5E1]">{alert.description}</p>

            {alert.impact ? (
              <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400/80" aria-hidden />
                <p className="text-xs leading-relaxed text-amber-200/90">{alert.impact}</p>
              </div>
            ) : null}

            {alert.action ? (
              <p className="text-xs leading-relaxed text-[#9FB2CE]">
                <span className="font-semibold text-[#BFD5F5]">Önerilen adım:</span>{" "}
                {alert.action}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onFix}
            className={`inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-4 py-2 text-xs font-semibold transition sm:w-auto ${style.iconButton}`}
          >
            <Wrench className="size-3.5" aria-hidden />
            {alert.ctaLabel}
          </button>

          <div className="flex items-center gap-1.5">
            <TooltipProvider>
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
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                  aria-label="Sonra hatırlat"
                >
                  <Clock3 className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
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
          </div>
        </div>
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
