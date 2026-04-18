import { memo } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  Package,
  Plus,
  Settings,
  ShieldAlert,
  Timer,
  TrendingUp,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";

type RowTone = "critical" | "warning" | "info";

const DASHBOARD_FILTERS = [7, 30, 90];

type PreviewInsightTone = "positive" | "negative" | "neutral";

const PREVIEW_INSIGHT_STYLES: Record<PreviewInsightTone, { text: string; dot: string }> = {
  positive: { text: "text-emerald-300/70", dot: "bg-emerald-400/60" },
  negative: { text: "text-amber-300/70", dot: "bg-amber-400/60" },
  neutral: { text: "text-[#8DA6C8]/50", dot: "bg-slate-400/40" },
};

const KPI_ITEMS: Array<{
  title: string;
  value: string;
  context: string;
  insight: { tone: PreviewInsightTone; label: string };
  icon: LucideIcon;
  hrefLabel: string;
}> = [
  {
    title: "Toplam Varlık",
    value: "148",
    context: "Kayıtlı varlık sayısı",
    insight: { tone: "positive", label: "İyi seviyede" },
    icon: Package,
    hrefLabel: "Detaya git",
  },
  {
    title: "Aktif Bakım Kuralı",
    value: "26",
    context: "Tanımlı aktif kural",
    insight: { tone: "positive", label: "İyi seviyede" },
    icon: Wrench,
    hrefLabel: "Detaya git",
  },
  {
    title: "Toplam Servis Maliyeti",
    value: "84.750 TL",
    context: "Son 30 gün",
    insight: { tone: "positive", label: "İyi seviyede" },
    icon: TrendingUp,
    hrefLabel: "Detaya git",
  },
  {
    title: "Belge Sayısı",
    value: "412",
    context: "Yüklü belge sayısı",
    insight: { tone: "neutral", label: "Aktivite yok" },
    icon: FileText,
    hrefLabel: "Detaya git",
  },
];

const PRIORITY_ROWS = [
  {
    title: "Klima B3 - Aylık filtre değişimi",
    dateLabel: "2 gün gecikti · 16 Mart 2026",
    actionLabel: "Servise git",
    tone: "critical" as const,
    icon: Wrench,
  },
  {
    title: "Jeneratör A1 garantisi bitiyor",
    dateLabel: "4 gün kaldı · 22 Mart 2026",
    actionLabel: "Detayı aç",
    tone: "warning" as const,
    icon: ShieldAlert,
  },
  {
    title: "Elektrik aboneliği ödeme vadesi",
    dateLabel: "6 gün kaldı · 3.420 TL · 24 Mart 2026",
    actionLabel: "Ödemeyi aç",
    tone: "info" as const,
    icon: WalletCards,
  },
  {
    title: "Laptop D12 - Teslim tutanağı eksik",
    dateLabel: "5 gündür belge yok · 13 Mart 2026",
    actionLabel: "Belge yükle",
    tone: "critical" as const,
    icon: FileText,
  },
];

const UPCOMING_ROWS = [
  {
    title: "Pompa C7 - Titreşim kontrolü",
    dateLabel: "1 gün sonra · 19 Mart 2026",
    actionLabel: "Servis kaydı",
    tone: "warning" as const,
    icon: Timer,
  },
  {
    title: "UPS Kabin 2 - Akü sağlık testi",
    dateLabel: "3 gün sonra · 21 Mart 2026",
    actionLabel: "Kurala git",
    tone: "info" as const,
    icon: Timer,
  },
  {
    title: "Assetly Premium yenileme",
    dateLabel: "5 gün sonra · 2.490 TL · 23 Mart 2026",
    actionLabel: "Faturayı aç",
    tone: "info" as const,
    icon: WalletCards,
  },
  {
    title: "Jeneratör A1 - 500 saatlik bakım",
    dateLabel: "6 gün sonra · 24 Mart 2026",
    actionLabel: "Planı aç",
    tone: "warning" as const,
    icon: ShieldAlert,
  },
];

const toneClass: Record<RowTone, string> = {
  critical: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  warning: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  info: "border-sky-300/35 bg-sky-300/10 text-sky-100",
};

function DashboardViewComponent({ menuItem }: PanelPreviewViewProps) {
  return (
    <div className="space-y-6 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.13),transparent_56%)] p-2 sm:p-3">
      <section className="rounded-2xl border border-white/5 bg-[linear-gradient(145deg,rgba(10,22,44,0.5),rgba(11,19,33,0.35))] p-5 sm:p-6">
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
              <h3 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">{menuItem.title}</h3>
              <p className="mt-2 max-w-2xl text-sm text-[#9FB2CE]">
                Tüm sistemi tek ekrandan yönetin: riskleri izleyin, hızlı aksiyon alın ve kritik alanları takip edin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#2A3E5F] bg-[#0D1B33]/70 p-1.5">
              <CalendarDays className="mx-1 size-4 text-[#86A3C8]" aria-hidden />
              {DASHBOARD_FILTERS.map((range) => {
                const isActive = range === 30;

                return (
                  <button
                    key={range}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border border-[#42608A] bg-[#173155] text-[#EAF2FF]"
                        : "text-[#9CB0CE] hover:bg-[#132A4A] hover:text-[#F1F5F9]"
                    }`}
                  >
                    Son {range} gün
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2F4569] bg-[#10243F] px-4 py-2 text-sm font-semibold text-[#E2E8F0] transition hover:bg-[#143158]"
            >
              <Plus className="size-4" aria-hidden />
              Hızlı Ekle
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#90A6C4]">Sistem Durumu</p>
                <h4 className="mt-1 text-lg font-semibold text-[#F8FAFC]">4 aktif kayıt için aksiyon bekleniyor</h4>
                <p className="mt-1 text-sm text-[#CBD5E1]">
                  Bir bakım gecikmesi, bir garanti bitişi, yaklaşan bir ödeme ve eksik bir belge kaydı şu anda öne çıkıyor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-fit rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                4 aktif kayıt
              </span>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-md border border-amber-300/40 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20"
                aria-label="Görmezden gel"
              >
                <X className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-md border border-amber-300/40 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20"
                aria-label="Sonra hatırlat"
              >
                <Clock3 className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-md border border-amber-300/40 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20"
                aria-label="Düzelt"
              >
                <Wrench className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold tracking-tight text-[#F8FAFC]">Özet Metrikler</h4>
            <span className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#8DA6C8]/60">
              Örnek veri
            </span>
          </div>
          <p className="text-xs text-[#8DA6C8]">Son 30 gün</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_ITEMS.map((card) => {
            const Icon = card.icon;
            const insightStyle = PREVIEW_INSIGHT_STYLES[card.insight.tone];

            return (
              <article
                key={card.title}
                className="group flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#8DA6C8]">{card.title}</p>
                  <Icon className="size-4 text-[#8DA6C8]/70" aria-hidden />
                </div>

                <p className="mt-6 text-3xl font-semibold tracking-tight text-[#F8FAFC]">{card.value}</p>
                <p className="mt-1.5 text-xs text-[#8DA6C8]/60">{card.context}</p>
                <p className={`mt-1 inline-flex items-center gap-1.5 text-xs ${insightStyle.text}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${insightStyle.dot}`} />
                  {card.insight.label}
                </p>

                <span className="mt-4 inline-flex items-center gap-1 text-xs text-[#8DA6C8] opacity-70 transition-opacity duration-200 group-hover:text-[#E2ECFF] group-hover:opacity-100">
                  {card.hrefLabel}
                  <ArrowRight
                    className="size-3.5 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskRowsPanel title="Öncelikli Riskler" rows={PRIORITY_ROWS} showSettingsAction />
        <RiskRowsPanel title="Yaklaşanlar (7 gün)" rows={UPCOMING_ROWS} />
      </div>
    </div>
  );
}

function RiskRowsPanel({
  title,
  rows,
  showSettingsAction = false,
}: {
  title: string;
  rows: Array<{
    title: string;
    dateLabel: string;
    actionLabel: string;
    tone: RowTone;
    icon: LucideIcon;
  }>;
  showSettingsAction?: boolean;
}) {
  return (
    <article className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h4 className="text-lg font-semibold text-[#F8FAFC]">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#345073] bg-[#102643] px-2.5 py-1 text-xs font-semibold text-[#C3D7F4]">
            {rows.length} kayıt
          </span>
          {showSettingsAction ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[#3C587C] bg-[#143258] px-2.5 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
            >
              <Settings className="size-3.5" aria-hidden />
              Düzenle
            </button>
          ) : null}
        </div>
      </div>

      <ul className="space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon;

          return (
            <li key={row.title} className="rounded-lg border border-white/5 bg-[#0E1E37]/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex rounded-lg border p-2 ${toneClass[row.tone]}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#EAF2FF]">{row.title}</p>
                    <p className="mt-1 text-xs text-[#9FB2CE]">{row.dateLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-fit items-center rounded-lg border border-[#3C587C] bg-[#143258] px-3 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
                  >
                    {row.actionLabel}
                  </button>

                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-[#3C587C] bg-[#102643] text-[#D7E6FC] transition hover:bg-[#18365B]"
                    aria-label="Görmezden gel"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export const DashboardView = memo(DashboardViewComponent);
DashboardView.displayName = "DashboardView";
