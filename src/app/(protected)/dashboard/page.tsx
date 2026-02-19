import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Factory,
  FileText,
  Package,
  Shield,
  Snowflake,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  getDashboardSnapshot,
  type DashboardCostCategory,
  type DashboardMaintenanceRiskItem,
  type DashboardQuickAsset,
  type DashboardServiceTimelineItem,
  type DashboardWarrantyRiskItem,
} from "@/lib/dashboard-queries";
import type { DbClient } from "@/lib/repos/_shared";
import { createClient } from "@/lib/supabase/server";

const SECTION_HEADER_CLASS = "mb-4 text-sm uppercase tracking-tight text-[#475569]";

const SERVICE_DOT_COLORS = ["bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-violet-400", "bg-rose-400"];

const ACTION_BUTTON_CLASS =
  "inline-flex items-center rounded-lg border border-[#334155] bg-[#0E1525] px-4 py-2 text-sm font-semibold text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#101A30]";

const COST_TREND_LABEL = "-15% geçen aya göre";
const RULE_TREND_LABEL = "+2 bu ay";
const METRIC_CARD_VALUES = {
  totalAssets: 8,
  activeRules: 12,
  totalServiceCost: 4850,
  documentCount: 23,
};

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  üretim: Factory,
  lojistik: Truck,
  güvenlik: Shield,
  soğutma: Snowflake,
  enerji: Zap,
  elektrik: Zap,
};

const formatPanelDate = (date: Date) => {
  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
  }).format(date);
  const weekdayLabel = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${dateLabel}, ${weekdayLabel}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));

const formatTry = (amount: number) => `${new Intl.NumberFormat("tr-TR").format(Math.round(amount))}₺`;

const dateDiffInDays = (value: string) => {
  const target = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getCategoryIcon = (category: string) => {
  const normalized = category.toLocaleLowerCase("tr-TR");
  return CATEGORY_ICON_MAP[normalized] ?? Package;
};

const getServiceDotColor = (index: number) => SERVICE_DOT_COLORS[index % SERVICE_DOT_COLORS.length];

const toDonutSegments = (categories: DashboardCostCategory[], total: number) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return categories.map((category) => {
    const ratio = total > 0 ? category.amount / total : 0;
    const length = ratio * circumference;
    const segment = {
      ...category,
      dashArray: `${length} ${circumference}`,
      dashOffset: `${-offset}`,
      radius,
      circumference,
    };
    offset += length;
    return segment;
  });
};

type MaintenanceTableProps = {
  title: string;
  badgeClassName: string;
  items: DashboardMaintenanceRiskItem[];
  dayLabel: string;
};

function MaintenanceRiskTable({ title, badgeClassName, items, dayLabel }: MaintenanceTableProps) {
  return (
    <article className="rounded-xl border border-[#1E293B] bg-[#0B1324] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E2E8F0]">{title}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClassName}`}>
          {items.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs text-[#94A3B8]">
          <thead>
            <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-tight text-[#64748B]">
              <th className="px-2 py-2">Varlık</th>
              <th className="px-2 py-2">Kural</th>
              <th className="px-2 py-2">Hedef Tarih</th>
              <th className="px-2 py-2">{dayLabel}</th>
              <th className="px-2 py-2 text-right">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-[#64748B]" colSpan={5}>
                  Kayıt bulunmuyor.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-[#1E293B]/70">
                  <td className="px-2 py-2 font-medium text-[#E2E8F0]">{item.assetName}</td>
                  <td className="px-2 py-2">{item.ruleTitle}</td>
                  <td className="px-2 py-2">{formatDate(item.dueDate)}</td>
                  <td className="px-2 py-2">{item.dayCount} gün</td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      href={`/services?asset=${item.assetId}&rule=${item.id}`}
                      className="inline-flex rounded-md border border-[#334155] px-2.5 py-1 font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#13203A]"
                    >
                      Servis Ekle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function WarrantyRiskTable({ items }: { items: DashboardWarrantyRiskItem[] }) {
  return (
    <article className="rounded-xl border border-[#1E293B] bg-[#0B1324] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E2E8F0]">Yaklaşan Garanti Bitişi (30 gün)</h3>
        <span className="rounded-full bg-blue-400/20 px-2.5 py-0.5 text-xs font-semibold text-blue-200">
          {items.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-xs text-[#94A3B8]">
          <thead>
            <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-tight text-[#64748B]">
              <th className="px-2 py-2">Varlık</th>
              <th className="px-2 py-2">Garanti Bitiş</th>
              <th className="px-2 py-2">Kalan Gün</th>
              <th className="px-2 py-2 text-right">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-[#64748B]" colSpan={4}>
                  Kayıt bulunmuyor.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-[#1E293B]/70">
                  <td className="px-2 py-2 font-medium text-[#E2E8F0]">{item.assetName}</td>
                  <td className="px-2 py-2">{formatDate(item.warrantyEndDate)}</td>
                  <td className="px-2 py-2">{item.daysRemaining} gün</td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      href={`/documents?asset=${item.assetId}`}
                      className="inline-flex rounded-md border border-[#334155] px-2.5 py-1 font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#13203A]"
                    >
                      Belge Gör
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ServiceTimeline({ items }: { items: DashboardServiceTimelineItem[] }) {
  return (
    <article className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
      <p className={SECTION_HEADER_CLASS}>Servis Akışı</p>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Son Servis Aktivitesi</h2>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#1E293B] bg-[#0B1324] px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${getServiceDotColor(index)}`} />
              <div>
                <p className="text-sm font-medium text-[#E2E8F0]">
                  {item.serviceType} • {item.assetName}
                </p>
                <p className="text-xs text-[#64748B]">{formatDate(item.serviceDate)}</p>
              </div>
            </div>
            <span className="rounded-full border border-[#334155] bg-[#111827] px-2.5 py-1 text-xs font-semibold text-[#E2E8F0]">
              {formatTry(item.cost)}
            </span>
          </div>
        ))}
      </div>
      <Link href="/services" className="mt-4 inline-flex text-sm font-semibold text-sky-300 transition hover:text-sky-200">
        Tümünü Gör →
      </Link>
    </article>
  );
}

function CostSummary({ categories, total }: { categories: DashboardCostCategory[]; total: number }) {
  const donutSegments = toDonutSegments(categories, total);

  return (
    <article className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
      <p className={SECTION_HEADER_CLASS}>Maliyet Dağılımı</p>
      <h2 className="text-lg font-semibold text-[#F8FAFC]">Maliyet Özeti</h2>
      <div className="mt-4 flex items-center justify-center">
        <div className="relative">
          <svg viewBox="0 0 140 140" className="h-44 w-44">
            <circle cx="70" cy="70" r="52" fill="none" stroke="#1E293B" strokeWidth="16" />
            {donutSegments.map((segment) => (
              <circle
                key={segment.id}
                cx="70"
                cy="70"
                r={segment.radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
                transform="rotate(-90 70 70)"
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">Toplam</span>
            <span className="text-lg font-semibold text-[#F8FAFC]">{formatTry(total)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {categories.slice(0, 3).map((category) => (
          <div key={category.id} className="flex items-center justify-between rounded-lg border border-[#1E293B] bg-[#0B1324] px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 text-[#CBD5E1]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.label}
            </span>
            <span className="rounded-full border border-[#334155] bg-[#111827] px-2 py-0.5 text-xs font-semibold text-[#E2E8F0]">
              {formatTry(category.amount)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AssetQuickView({ assets }: { assets: DashboardQuickAsset[] }) {
  return (
    <section className="col-span-12 rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
      <p className={SECTION_HEADER_CLASS}>Hızlı Görünüm</p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Varlıklarım</h2>
        <Link href="/assets" className="text-sm font-semibold text-sky-300 transition hover:text-sky-200">
          Tümünü Gör →
        </Link>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {assets.map((asset) => {
          const CategoryIcon = getCategoryIcon(asset.category);
          const dueInDays = asset.nextDueDate ? dateDiffInDays(asset.nextDueDate) : null;
          const dueBadgeClass =
            dueInDays === null
              ? "border-[#334155] bg-[#0B1324] text-[#94A3B8]"
              : dueInDays < 0
                ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
                : dueInDays <= 7
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                  : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
          const dueLabel =
            dueInDays === null
              ? "Bakım planı yok"
              : dueInDays < 0
                ? `${Math.abs(dueInDays)} gün gecikti`
                : `${dueInDays} gün kaldı`;

          return (
            <article key={asset.id} className="w-48 shrink-0 snap-start rounded-xl border border-[#1E293B] bg-[#0E1525] p-4">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#334155] bg-[#0B1324] text-sky-300">
                <CategoryIcon className="size-5" aria-hidden />
              </div>
              <p className="line-clamp-2 min-h-10 text-sm font-semibold text-[#F8FAFC]">{asset.name}</p>
              <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueBadgeClass}`}>
                {dueLabel}
              </span>
              <span className="mt-2 inline-flex rounded-full border border-[#334155] bg-[#0B1324] px-2 py-0.5 text-[11px] text-[#94A3B8]">
                {asset.category}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const snapshot = await getDashboardSnapshot(supabase as DbClient, user.id);
  const riskCount =
    snapshot.data.riskPanel.overdueMaintenance.length +
    snapshot.data.riskPanel.upcomingMaintenance.length +
    snapshot.data.riskPanel.upcomingWarranty.length;
  const hasRiskItems = riskCount > 0;

  return (
    <AppShell
      badge="Kontrol Merkezi"
      title="Panel"
      subtitle={formatPanelDate(new Date())}
    >
      <div className="rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.30),transparent_55%)] p-4 sm:p-5">
        {snapshot.warning ? (
          <p className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            {snapshot.warning}
          </p>
        ) : null}

        <div className="grid grid-cols-12 gap-4">
          <section className="col-span-12">
            <div className="flex flex-wrap gap-2">
              <Link href="/assets" className={ACTION_BUTTON_CLASS}>
                + Varlık Ekle
              </Link>
              <Link href="/services" className={ACTION_BUTTON_CLASS}>
                + Servis Kaydı
              </Link>
              <Link href="/reports" className={ACTION_BUTTON_CLASS}>
                PDF Rapor
              </Link>
            </div>
          </section>

          <section className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Toplam Varlık"
              value={METRIC_CARD_VALUES.totalAssets}
              icon={Package}
              trendLabel="Stabil"
              trendTone="neutral"
            />
            <MetricCard
              title="Aktif Bakım Kuralı"
              value={METRIC_CARD_VALUES.activeRules}
              icon={Wrench}
              trendLabel={RULE_TREND_LABEL}
              trendTone="neutral"
            />
            <MetricCard
              title="Toplam Servis Maliyeti"
              value={formatTry(METRIC_CARD_VALUES.totalServiceCost)}
              icon={TrendingUp}
              trendLabel={COST_TREND_LABEL}
              trendTone="positive"
            />
            <MetricCard
              title="Belge Sayısı"
              value={METRIC_CARD_VALUES.documentCount}
              icon={FileText}
              trendLabel="Stabil"
              trendTone="neutral"
            />
          </section>

          <section className="col-span-12 rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
            <p className={SECTION_HEADER_CLASS}>Öncelikli Riskler</p>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#F8FAFC]">⚠️ Risk Paneli</h2>
              <span className="rounded-full border border-[#334155] bg-[#111827] px-3 py-1 text-xs font-semibold text-[#CBD5E1]">
                {riskCount} kayıt
              </span>
            </div>

            {!hasRiskItems ? (
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-5 text-sm text-emerald-100">
                <p className="text-base font-semibold">✅ Tüm varlıklar kontrol altında 🎉</p>
              </div>
            ) : (
              <div className="grid gap-4 2xl:grid-cols-3">
                <MaintenanceRiskTable
                  title="Gecikmiş Bakım"
                  badgeClassName="bg-rose-400/20 text-rose-200"
                  items={snapshot.data.riskPanel.overdueMaintenance}
                  dayLabel="Gecikme"
                />
                <MaintenanceRiskTable
                  title="Yaklaşan Bakım (7 gün)"
                  badgeClassName="bg-amber-300/20 text-amber-100"
                  items={snapshot.data.riskPanel.upcomingMaintenance}
                  dayLabel="Kalan"
                />
                <WarrantyRiskTable items={snapshot.data.riskPanel.upcomingWarranty} />
              </div>
            )}
          </section>

          <section className="col-span-12 grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ServiceTimeline items={snapshot.data.recentServices} />
            </div>
            <div className="xl:col-span-5">
              <CostSummary categories={snapshot.data.costSummary.categories} total={snapshot.data.costSummary.total} />
            </div>
          </section>

          <AssetQuickView assets={snapshot.data.quickAssets} />
        </div>
      </div>
    </AppShell>
  );
}
