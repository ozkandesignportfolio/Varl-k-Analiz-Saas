import { memo } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
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

type TrendDirection = "up" | "down" | "flat";
type RowTone = "critical" | "warning" | "info";

const DASHBOARD_FILTERS = [7, 30, 90];

const TREND_META: Record<
  TrendDirection,
  {
    icon: LucideIcon;
    textClass: string;
    sparklineClass: string;
    symbol: string;
  }
> = {
  up: {
    icon: ArrowUpRight,
    textClass: "text-emerald-200",
    sparklineClass: "stroke-emerald-300",
    symbol: "+",
  },
  down: {
    icon: ArrowDownRight,
    textClass: "text-rose-200",
    sparklineClass: "stroke-rose-300",
    symbol: "-",
  },
  flat: {
    icon: ArrowRight,
    textClass: "text-slate-200",
    sparklineClass: "stroke-slate-300",
    symbol: "0",
  },
};

const KPI_ITEMS = [
  {
    title: "Toplam Varlık",
    value: "148",
    trend: { direction: "up" as const, percentage: 6, sparkline: [118, 122, 127, 133, 141, 148] },
    icon: Package,
    hrefLabel: "Detaya git",
  },
  {
    title: "Aktif Bakım Kuralı",
    value: "26",
    trend: { direction: "up" as const, percentage: 9, sparkline: [18, 19, 20, 22, 24, 26] },
    icon: Wrench,
    hrefLabel: "Detaya git",
  },
  {
    title: "Toplam Servis Maliyeti",
    value: "84.750 TL",
    trend: { direction: "down" as const, percentage: 4, sparkline: [96, 94, 92, 90, 88, 84] },
    icon: TrendingUp,
    hrefLabel: "Detaya git",
  },
  {
    title: "Belge Sayısı",
    value: "412",
    trend: { direction: "up" as const, percentage: 11, sparkline: [352, 360, 372, 384, 398, 412] },
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-lg font-semibold text-[#F8FAFC]">Özet Metrikler</h4>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8DA6C8]">Son 30 gün trendi</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {KPI_ITEMS.map((card) => {
            const trendMeta = TREND_META[card.trend.direction];
            const TrendIcon = trendMeta.icon;
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="rounded-2xl border border-[#273955] bg-[linear-gradient(160deg,rgba(10,22,44,0.92),rgba(11,19,33,0.84))] p-4 shadow-[0_16px_34px_rgba(2,8,20,0.36)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#89A2C5]">{card.title}</p>
                  <span className="inline-flex rounded-lg border border-[#2E4467] bg-[#10223E] p-2 text-[#9AB2D1]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>

                <p className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC]">{card.value}</p>

                <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${trendMeta.textClass}`}>
                  <TrendIcon className="size-3.5" aria-hidden />
                  <span>
                    {trendMeta.symbol}
                    {card.trend.percentage}%
                  </span>
                </div>

                <div className="mt-3 rounded-lg border border-[#2A3D5B] bg-[#0A162A]/70 p-2">
                  <Sparkline points={card.trend.sparkline} pathClass={trendMeta.sparklineClass} />
                </div>

                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#B8CEF0] transition hover:text-[#E2ECFF]"
                >
                  {card.hrefLabel}
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
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
    <article className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(150deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
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
            <li key={row.title} className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
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

function Sparkline({ points, pathClass }: { points: number[]; pathClass: string }) {
  const safePoints = points.length > 0 ? points : [10, 10, 10, 10, 10, 10];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints, 0);
  const range = Math.max(1, max - min);
  const xStep = 100 / Math.max(1, safePoints.length - 1);

  const polylinePoints = safePoints
    .map((point, index) => {
      const x = index * xStep;
      const normalized = (point - min) / range;
      const y = 90 - normalized * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={polylinePoints}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={pathClass}
      />
    </svg>
  );
}

export const DashboardView = memo(DashboardViewComponent);
DashboardView.displayName = "DashboardView";
