/**
 * Decision intelligence alert engine.
 *
 * Converts raw risk data into context-aware, severity-tiered alerts
 * with aggregation, grouping, escalation tiers, and smart prioritization.
 *
 * Architecture:
 *  1. Per-item builders — severity-tiered individual alerts
 *  2. Grouping layer — groups by type with summary headers
 *  3. Aggregation layer — cross-type dashboard summary with escalation
 *  4. Smart top-N — show top 3 alerts, collapse the rest
 *  5. Phrase rotation — avoid repetitive wording
 */

import type { LucideIcon } from "lucide-react";
import type {
  DashboardMaintenanceRiskItem,
  DashboardWarrantyRiskItem,
  DashboardPaymentRiskItem,
  DashboardMissingDocumentRiskItem,
  DashboardSnapshot,
  DashboardSystemStatus,
} from "@/features/dashboard/api/dashboard-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertTone = "critical" | "warning" | "info";

export type AlertDecision = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  impact: string;
  dateLabel: string;
  sortDate: string;
  actionHref: string;
  actionLabel: string;
  alertKey: string;
  tone: AlertTone;
  /** Lower = higher priority. Used for final sort. */
  priority: number;
  /** Alert category key for grouping */
  groupKey: AlertGroupKey;
};

export type AlertGroupKey = "maintenance" | "warranty" | "payment" | "document";

export type AlertGroup = {
  key: AlertGroupKey;
  label: string;
  tone: AlertTone;
  totalCount: number;
  criticalCount: number;
  /** Top N visible alerts */
  visible: AlertDecision[];
  /** Remaining collapsed alerts */
  collapsed: AlertDecision[];
  /** Summary action for the entire group */
  groupActionLabel: string;
  groupActionHref: string;
};

/** Escalation tier for dashboard-level summary */
export type EscalationTier = "standard" | "grouped" | "dashboard_warning";

export type HeaderAlertContent = {
  severityLabel: string;
  title: string;
  description: string;
  impact: string;
  action: string;
  ctaLabel: string;
  escalationTier: EscalationTier;
  /** Breakdown counts by type for the aggregated summary */
  breakdown: { label: string; count: number; tone: AlertTone }[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TONE_PRIORITY: Record<AlertTone, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// Formatters (local)
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
const CURRENCY_FMT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (v: string) => DATE_FMT.format(new Date(v.includes("T") ? v : `${v}T00:00:00`));
const fmtCur = (v: number) => `${CURRENCY_FMT.format(v)} TL`;

const toKey = (type: string, id: string, date: string) => `${type}:${id}:${date}`;

// ---------------------------------------------------------------------------
// Phrase rotation helpers — pick variant based on index to avoid repetition
// ---------------------------------------------------------------------------

const pick = <T>(variants: T[], index: number): T => variants[index % variants.length];

// ---------------------------------------------------------------------------
// Overdue maintenance decision
// ---------------------------------------------------------------------------

const OVERDUE_MAINT_TITLES = [
  (a: string, d: number) => `"${a}" Bakımı ${d} Gündür Gecikmiş Durumda`,
  (a: string, d: number) => `"${a}" İçin Geciken Bakım: ${d} Gün`,
  (a: string, d: number) => `${d} Günlük Bakım Gecikmesi — "${a}"`,
];

const OVERDUE_MAINT_DESC = [
  (a: string, r: string, dt: string) => `"${a}" için planlanan "${r}" bakımı ${dt} tarihinde yapılmalıydı ancak henüz tamamlanmadı.`,
  (a: string, r: string, dt: string) => `"${r}" bakım kuralı kapsamında "${a}" varlığının ${dt} tarihli bakımı gerçekleştirilmedi.`,
];

function buildOverdueMaintenance(item: DashboardMaintenanceRiskItem, idx: number): AlertDecision {
  const days = item.dayCount;
  const date = fmtDate(item.dueDate);

  let impact: string;
  let actionLabel: string;
  let tone: AlertTone = "critical";

  if (days > 30) {
    impact = "Ciddi gecikme! Uzun süreli bakımsızlık arıza olasılığını katlar ve onarım maliyetleri kontrol dışına çıkabilir. Derhal müdahale gereklidir.";
    actionLabel = "Acil Bakım Başlat";
  } else if (days > 14) {
    impact = "İki haftayı aşan gecikme arıza riskini ciddi şekilde artırır ve onarım maliyetleri yükselebilir.";
    actionLabel = "Gecikmiş Bakımı Hemen Tamamla";
  } else if (days > 7) {
    impact = "Bakım geciktikçe performans düşer ve uzun vadede onarım maliyetleri artar. En kısa sürede tamamlanmalı.";
    actionLabel = "Bakımı Bu Hafta Tamamla";
  } else {
    impact = "Bakım tarihi kısa süre önce geçti. Bugün planlayarak sorunu büyümeden çözebilirsiniz.";
    actionLabel = "Bugün Bakım Planla";
  }

  return {
    id: `overdue-${item.id}`,
    icon: null as unknown as LucideIcon, // injected by caller
    title: pick(OVERDUE_MAINT_TITLES, idx)(item.assetName, days),
    description: pick(OVERDUE_MAINT_DESC, idx)(item.assetName, item.ruleTitle, date),
    impact,
    dateLabel: `${days} gün gecikti · ${date}`,
    sortDate: item.dueDate,
    actionHref: `/services?asset=${item.assetId}&rule=${item.id}`,
    actionLabel,
    alertKey: toKey("overdue-maintenance", item.id, item.dueDate),
    tone,
    priority: days > 30 ? -1 : TONE_PRIORITY[tone],
    groupKey: "maintenance",
  };
}

// ---------------------------------------------------------------------------
// Upcoming maintenance decision
// ---------------------------------------------------------------------------

const UPCOMING_MAINT_TITLES = [
  (a: string, d: number) => `"${a}" Bakımı ${d} Gün İçinde Yapılmalı`,
  (a: string, d: number) => `"${a}" İçin ${d} Gün Sonra Bakım Planlanmalı`,
  (a: string, d: number) => `Yaklaşan Bakım: "${a}" — ${d} Gün Kaldı`,
];

function buildUpcomingMaintenance(item: DashboardMaintenanceRiskItem, idx: number): AlertDecision {
  const days = item.dayCount;
  const date = fmtDate(item.dueDate);

  let impact: string;
  let actionLabel: string;
  let tone: AlertTone;

  if (days <= 1) {
    impact = "Bakım bugün veya yarın yapılmalı. Hazırlıkları hemen tamamlayın, aksi halde gecikme başlar.";
    actionLabel = "Bugün Bakımı Yap";
    tone = "warning";
  } else if (days <= 3) {
    impact = "Bakım tarihi çok yakın — hazırlıkları şimdiden başlatın, gecikme riski yüksek.";
    actionLabel = "Bakım Hazırlığını Başlat";
    tone = "warning";
  } else if (days <= 7) {
    impact = "Bu hafta içinde bakım zamanı geliyor. Şimdiden planlayarak gecikmeyi önleyin.";
    actionLabel = "Bu Hafta Planla";
    tone = "info";
  } else {
    impact = "Bakımı önceden planlayarak arıza riskini önleyin ve varlık performansını koruyun.";
    actionLabel = "Bakımı Önceden Planla";
    tone = "info";
  }

  return {
    id: `upcoming-maintenance-${item.id}`,
    icon: null as unknown as LucideIcon,
    title: pick(UPCOMING_MAINT_TITLES, idx)(item.assetName, days),
    description: `"${item.assetName}" için "${item.ruleTitle}" bakımı ${date} tarihinde yapılmalı.`,
    impact,
    dateLabel: `${days} gün sonra · ${date}`,
    sortDate: item.dueDate,
    actionHref: `/services?asset=${item.assetId}&rule=${item.id}`,
    actionLabel,
    alertKey: toKey("upcoming-maintenance", item.id, item.dueDate),
    tone,
    priority: TONE_PRIORITY[tone],
    groupKey: "maintenance",
  };
}

// ---------------------------------------------------------------------------
// Warranty decision
// ---------------------------------------------------------------------------

const WARRANTY_EXPIRED_TITLES = [
  (a: string) => `"${a}" Garanti Süresi Doldu`,
  (a: string) => `"${a}" İçin Garanti Kapsamı Sona Erdi`,
];

const WARRANTY_EXPIRING_TITLES = [
  (a: string, d: number) => `"${a}" Garantisi ${d} Gün İçinde Sona Eriyor`,
  (a: string, d: number) => `"${a}" İçin Garanti Bitimine ${d} Gün Kaldı`,
];

function buildWarrantyAlert(item: DashboardWarrantyRiskItem, idx: number, isUpcoming: boolean): AlertDecision {
  const days = item.daysRemaining;
  const date = fmtDate(item.warrantyEndDate);
  const expired = days <= 0;

  let title: string;
  let description: string;
  let impact: string;
  let actionLabel: string;
  let tone: AlertTone;

  if (expired) {
    title = pick(WARRANTY_EXPIRED_TITLES, idx)(item.assetName);
    description = `"${item.assetName}" garanti süresi ${date} tarihinde sona erdi. Artık garanti kapsamı dışındasınız.`;
    impact = "Garanti sona erdiğinden olası arızalarda tüm onarım masrafları size ait olacaktır. Mevcut sorunları kayıt altına alın.";
    actionLabel = "Varlık Detayını İncele";
    tone = "critical";
  } else if (days <= 3) {
    title = pick(WARRANTY_EXPIRING_TITLES, idx)(item.assetName, days);
    description = `"${item.assetName}" garanti bitiş tarihi ${date}. Kalan süre yalnızca ${days} gün.`;
    impact = "Son günlerde sorun varsa hemen bildirin — garanti bittikten sonra ücretsiz onarım hakkını kaybedersiniz.";
    actionLabel = "Garanti Bitmeden Kontrol Ettir";
    tone = "critical";
  } else if (days <= 7) {
    title = pick(WARRANTY_EXPIRING_TITLES, idx)(item.assetName, days);
    description = `"${item.assetName}" garanti bitiş tarihi ${date}. Kalan süre: ${days} gün.`;
    impact = "Garanti bitmeden mevcut sorunları bildirmezseniz ücretsiz onarım hakkını kaybedersiniz.";
    actionLabel = "Garanti Kapsamını Kontrol Et";
    tone = "warning";
  } else {
    title = pick(WARRANTY_EXPIRING_TITLES, idx)(item.assetName, days);
    description = `"${item.assetName}" garanti bitiş tarihi ${date}. Garanti süresi devam ediyor.`;
    impact = "Garanti bitiş tarihini takip edin ve olası sorunları zamanında bildirin.";
    actionLabel = "Detayları Gör";
    tone = "info";
  }

  const dateLabel = expired
    ? `Süresi doldu · ${date}`
    : `${days} gün kaldı · ${date}`;

  return {
    id: isUpcoming ? `upcoming-warranty-${item.id}` : `warranty-${item.id}`,
    icon: null as unknown as LucideIcon,
    title,
    description,
    impact,
    dateLabel,
    sortDate: item.warrantyEndDate,
    actionHref: `/assets/${item.assetId}`,
    actionLabel,
    alertKey: toKey("warranty", item.id, item.warrantyEndDate),
    tone,
    priority: TONE_PRIORITY[tone],
    groupKey: "warranty",
  };
}

// ---------------------------------------------------------------------------
// Payment decision
// ---------------------------------------------------------------------------

const PAYMENT_OVERDUE_TITLES = [
  (s: string, d: number) => `"${s}" Ödemesi ${d} Gündür Gecikmiş`,
  (s: string, d: number) => `${d} Günlük Ödeme Gecikmesi — "${s}"`,
];

const PAYMENT_UPCOMING_TITLES = [
  (s: string, d: number) => `"${s}" Ödemesi ${d} Gün İçinde`,
  (s: string, d: number) => `"${s}" İçin ${d} Gün Sonra Ödeme Yapılmalı`,
];

function buildPaymentAlert(item: DashboardPaymentRiskItem, idx: number): AlertDecision {
  const isOverdue = item.daysRemaining < 0;
  const absDays = Math.abs(item.daysRemaining);
  const date = fmtDate(item.dueDate);
  const amount = fmtCur(item.totalAmount);

  let title: string;
  let description: string;
  let impact: string;
  let actionLabel: string;
  let tone: AlertTone;

  if (isOverdue && absDays > 30) {
    title = pick(PAYMENT_OVERDUE_TITLES, idx)(item.subscriptionName, absDays);
    description = `"${item.subscriptionName}" için ${amount} tutarındaki ödeme ${date} tarihinde yapılmalıydı. ${absDays} gündür ödenmedi.`;
    impact = "Ciddi gecikme! Ek faiz, ceza ve hizmet kesintisi riski artmaktadır. Acil ödeme yapılmalıdır.";
    actionLabel = "Acil Ödeme Yap";
    tone = "critical";
  } else if (isOverdue && absDays > 7) {
    title = pick(PAYMENT_OVERDUE_TITLES, idx)(item.subscriptionName, absDays);
    description = `"${item.subscriptionName}" için ${amount} tutarındaki ödeme ${date} tarihinde yapılmalıydı ancak henüz ödenmedi.`;
    impact = "Geciken ödemeler ek ücret, faiz veya hizmet kesintisine neden olabilir.";
    actionLabel = "Gecikmiş Ödemeyi Hemen Yap";
    tone = "critical";
  } else if (isOverdue) {
    title = pick(PAYMENT_OVERDUE_TITLES, idx)(item.subscriptionName, absDays);
    description = `"${item.subscriptionName}" için ${amount} tutarındaki ödeme ${date} tarihinde yapılmalıydı.`;
    impact = "Ödeme tarihi kısa süre önce geçti. Bugün ödeme yaparak gecikme cezasından kaçının.";
    actionLabel = "Bugün Ödeme Yap";
    tone = "warning";
  } else if (item.daysRemaining <= 3) {
    title = pick(PAYMENT_UPCOMING_TITLES, idx)(item.subscriptionName, item.daysRemaining);
    description = `"${item.subscriptionName}" için ${amount} tutarındaki ödeme ${date} tarihinde yapılmalı.`;
    impact = "Ödeme tarihi çok yakın — şimdiden ödeme hazırlığı yaparak gecikme riskini ortadan kaldırın.";
    actionLabel = "Ödemeyi Şimdi Yap";
    tone = "warning";
  } else {
    title = pick(PAYMENT_UPCOMING_TITLES, idx)(item.subscriptionName, item.daysRemaining);
    description = `"${item.subscriptionName}" için ${amount} tutarındaki ödeme ${date} tarihinde yapılmalı.`;
    impact = "Zamanında ödeme yaparak gecikme cezası ve olası hizmet kesintisi riskinden kaçının.";
    actionLabel = "Fatura Detayı";
    tone = "info";
  }

  const dateLabel = isOverdue
    ? `${absDays} gün gecikti · ${amount} · ${date}`
    : `${item.daysRemaining} gün kaldı · ${amount} · ${date}`;

  return {
    id: `payment-${item.id}`,
    icon: null as unknown as LucideIcon,
    title,
    description,
    impact,
    dateLabel,
    sortDate: item.dueDate,
    actionHref: "/invoices",
    actionLabel,
    alertKey: toKey("payment", item.id, item.dueDate),
    tone,
    priority: TONE_PRIORITY[tone],
    groupKey: "payment",
  };
}

// ---------------------------------------------------------------------------
// Missing documents decision
// ---------------------------------------------------------------------------

const MISSING_DOC_TITLES = [
  (a: string, d: number) => `"${a}" İçin ${d} Gündür Belge Yok`,
  (a: string, d: number) => `"${a}" Varlığına ${d} Gündür Belge Eklenmemiş`,
];

function buildMissingDocAlert(item: DashboardMissingDocumentRiskItem, idx: number): AlertDecision {
  const days = item.daysWithoutDocument;
  const date = fmtDate(item.createdAt);

  let impact: string;
  let actionLabel: string;
  let tone: AlertTone;

  if (days > 30) {
    impact = "Uzun süredir belge eksik. Garanti, sigorta veya denetim süreçlerinde ciddi sorun yaşanabilir. Acil belge yükleyin.";
    actionLabel = "Hemen Belge Yükle";
    tone = "warning";
  } else if (days > 14) {
    impact = "Eksik belgeler garanti başvurusu, sigorta talebi veya denetim süreçlerinde sorun yaratabilir.";
    actionLabel = "Belge Yükle";
    tone = "info";
  } else {
    impact = "Varlık kaydı yeni oluşturulmuş. İlgili belgeleri yükleyerek arşivinizi tamamlayın.";
    actionLabel = "Belge Ekle";
    tone = "info";
  }

  return {
    id: `docs-${item.id}`,
    icon: null as unknown as LucideIcon,
    title: pick(MISSING_DOC_TITLES, idx)(item.assetName, days),
    description: `"${item.assetName}" varlığına kayıt tarihinden (${date}) bu yana hiç belge eklenmemiş.`,
    impact,
    dateLabel: `${days} gündür belge yok · ${date}`,
    sortDate: item.createdAt,
    actionHref: `/documents?asset=${item.assetId}`,
    actionLabel,
    alertKey: toKey("missing-document", item.id, item.createdAt),
    tone,
    priority: TONE_PRIORITY[tone],
    groupKey: "document",
  };
}

// ---------------------------------------------------------------------------
// Grouping constants
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<AlertGroupKey, string> = {
  maintenance: "Bakım",
  warranty: "Garanti",
  payment: "Ödeme",
  document: "Belge",
};

const GROUP_ACTION_HREFS: Record<AlertGroupKey, string> = {
  maintenance: "/maintenance",
  warranty: "/assets",
  payment: "/invoices",
  document: "/documents",
};

const VISIBLE_PER_GROUP = 3;

// ---------------------------------------------------------------------------
// Internal: sort helper
// ---------------------------------------------------------------------------

const sortByPriorityThenDate = (a: AlertDecision, b: AlertDecision) =>
  a.priority - b.priority || new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();

const highestTone = (alerts: AlertDecision[]): AlertTone => {
  if (alerts.some((a) => a.tone === "critical")) return "critical";
  if (alerts.some((a) => a.tone === "warning")) return "warning";
  return "info";
};

// ---------------------------------------------------------------------------
// Internal: build group action label based on severity distribution
// ---------------------------------------------------------------------------

function buildGroupAction(key: AlertGroupKey, alerts: AlertDecision[]): string {
  const critCount = alerts.filter((a) => a.tone === "critical").length;
  const total = alerts.length;

  switch (key) {
    case "maintenance":
      if (critCount > 0) return `Tüm Gecikmiş Bakımları Planla (${critCount})`;
      return total > 1 ? `${total} Bakımı Planla` : "Bakımı Planla";
    case "warranty":
      if (critCount > 0) return "Kritik Garanti İşlemlerini Kontrol Et";
      return total > 1 ? `${total} Garanti Kaydını İncele` : "Garanti Detayını Gör";
    case "payment":
      if (critCount > 0) return `Gecikmiş Ödemeleri Hemen Yap (${critCount})`;
      return total > 1 ? `${total} Ödemeyi Kontrol Et` : "Ödeme Detayını Gör";
    case "document":
      return total > 1 ? `${total} Varlığa Belge Yükle` : "Belge Yükle";
  }
}

// ---------------------------------------------------------------------------
// Public: build risk panel alerts (flat, sorted by priority)
// ---------------------------------------------------------------------------

export function buildRiskAlerts(riskPanel: DashboardSnapshot["riskPanel"]): AlertDecision[] {
  const rows: AlertDecision[] = [
    ...riskPanel.overdueMaintenance.map((item, i) => buildOverdueMaintenance(item, i)),
    ...riskPanel.upcomingWarranty.map((item, i) => buildWarrantyAlert(item, i, false)),
    ...riskPanel.upcomingPayments.map((item, i) => buildPaymentAlert(item, i)),
    ...riskPanel.missingDocuments.map((item, i) => buildMissingDocAlert(item, i)),
  ];

  return rows.sort(sortByPriorityThenDate).slice(0, 10);
}

export function buildUpcomingAlerts(riskPanel: DashboardSnapshot["riskPanel"]): AlertDecision[] {
  const rows: AlertDecision[] = [
    ...riskPanel.upcomingMaintenance.map((item, i) => buildUpcomingMaintenance(item, i)),
    ...riskPanel.upcomingWarranty
      .filter((item) => item.daysRemaining > 0 && item.daysRemaining <= 7)
      .map((item, i) => buildWarrantyAlert(item, i, true)),
    ...riskPanel.upcomingPayments
      .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 7)
      .map((item, i) => buildPaymentAlert(item, i)),
  ];

  return rows.sort(sortByPriorityThenDate).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public: build GROUPED risk alerts (type-grouped with top-N + collapse)
// ---------------------------------------------------------------------------

export function buildGroupedAlerts(alerts: AlertDecision[]): AlertGroup[] {
  const grouped = new Map<AlertGroupKey, AlertDecision[]>();

  for (const alert of alerts) {
    const existing = grouped.get(alert.groupKey) ?? [];
    existing.push(alert);
    grouped.set(alert.groupKey, existing);
  }

  const groups: AlertGroup[] = [];

  for (const [key, items] of grouped) {
    const sorted = items.sort(sortByPriorityThenDate);
    const visible = sorted.slice(0, VISIBLE_PER_GROUP);
    const collapsed = sorted.slice(VISIBLE_PER_GROUP);

    groups.push({
      key,
      label: GROUP_LABELS[key],
      tone: highestTone(sorted),
      totalCount: sorted.length,
      criticalCount: sorted.filter((a) => a.tone === "critical").length,
      visible,
      collapsed,
      groupActionLabel: buildGroupAction(key, sorted),
      groupActionHref: GROUP_ACTION_HREFS[key],
    });
  }

  return groups.sort((a, b) => {
    const tonePri = TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone];
    if (tonePri !== 0) return tonePri;
    return b.criticalCount - a.criticalCount;
  });
}

// ---------------------------------------------------------------------------
// Public: build aggregated header summary (cross-type with escalation tiers)
// ---------------------------------------------------------------------------

export function buildHeaderAlert(
  status: DashboardSystemStatus,
  riskPanel: DashboardSnapshot["riskPanel"],
): HeaderAlertContent {
  const overdueCount = riskPanel.overdueMaintenance.length;
  const maxOverdueDays = riskPanel.overdueMaintenance.reduce((max, i) => Math.max(max, i.dayCount), 0);
  const warrantyExpiredCount = riskPanel.upcomingWarranty.filter((i) => i.daysRemaining <= 0).length;
  const warningWarrantyCount = riskPanel.upcomingWarranty.filter((i) => i.daysRemaining > 0 && i.daysRemaining <= 7).length;
  const overduePmtCount = riskPanel.upcomingPayments.filter((i) => i.daysRemaining < 0).length;
  const upcomingPmtCount = riskPanel.upcomingPayments.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= 7).length;
  const docCount = riskPanel.missingDocuments.length;

  const criticalTotal = overdueCount + warrantyExpiredCount + overduePmtCount;
  const warningTotal = warningWarrantyCount + upcomingPmtCount;
  const allIssues = criticalTotal + warningTotal + docCount;

  const breakdown: HeaderAlertContent["breakdown"] = [];
  if (overdueCount > 0) breakdown.push({ label: `${overdueCount} gecikmiş bakım`, count: overdueCount, tone: "critical" });
  if (warrantyExpiredCount > 0) breakdown.push({ label: `${warrantyExpiredCount} süresi dolan garanti`, count: warrantyExpiredCount, tone: "critical" });
  if (overduePmtCount > 0) breakdown.push({ label: `${overduePmtCount} gecikmiş ödeme`, count: overduePmtCount, tone: "critical" });
  if (warningWarrantyCount > 0) breakdown.push({ label: `${warningWarrantyCount} yaklaşan garanti`, count: warningWarrantyCount, tone: "warning" });
  if (upcomingPmtCount > 0) breakdown.push({ label: `${upcomingPmtCount} yaklaşan ödeme`, count: upcomingPmtCount, tone: "warning" });
  if (docCount > 0) breakdown.push({ label: `${docCount} eksik belge`, count: docCount, tone: "info" });

  // --- Escalation tier logic ---
  // Tier 1: Standard (0–1 issue type)
  // Tier 2: Grouped (2–3 issue types)
  // Tier 3: Dashboard warning (4+ issue types or criticalTotal >= 4)

  const activeTypeCount = breakdown.length;
  let escalationTier: EscalationTier;

  if (activeTypeCount >= 4 || criticalTotal >= 4) {
    escalationTier = "dashboard_warning";
  } else if (activeTypeCount >= 2) {
    escalationTier = "grouped";
  } else {
    escalationTier = "standard";
  }

  // --- Healthy state ---
  if (allIssues === 0 || status.tone === "healthy") {
    if (criticalTotal === 0 && warningTotal === 0 && docCount === 0) {
      return {
        severityLabel: "Sağlıklı",
        title: "Her Şey Yolunda",
        description: "Kritik veya yaklaşan risk kaydı bulunmuyor. Sisteminiz sağlıklı çalışıyor.",
        impact: "",
        action: "",
        ctaLabel: "Tercihleri Düzenle",
        escalationTier: "standard",
        breakdown: [],
      };
    }
  }

  // --- Dashboard warning tier (4+ types or 4+ critical) ---
  if (escalationTier === "dashboard_warning") {
    const breakdownText = breakdown.map((b) => b.label).join(", ");
    return {
      severityLabel: "Kritik",
      title: `${allIssues} Kritik İşlem Dikkat Gerektiriyor`,
      description: `Sisteminizde birden fazla alanda sorun tespit edildi: ${breakdownText}. Acil müdahale gereklidir.`,
      impact: "Çoklu risk alanlarında birikim, sistem genelinde performans kaybı ve kontrolsüz maliyet artışına yol açar.",
      action: "Kritik işlemleri öncelik sırasına göre şimdi çözün.",
      ctaLabel: "Kritik İşlemleri Şimdi Çöz",
      escalationTier,
      breakdown,
    };
  }

  // --- Grouped tier (2–3 issue types) ---
  if (escalationTier === "grouped") {
    const breakdownText = breakdown.map((b) => b.label).join(", ");
    const hasCritical = criticalTotal > 0;

    return {
      severityLabel: hasCritical ? "Kritik" : "Uyarı",
      title: hasCritical
        ? `${criticalTotal} Kritik ve ${warningTotal + docCount} Diğer İşlem Bekliyor`
        : `${allIssues} İşlem Dikkat Gerektiriyor`,
      description: `Farklı alanlarda işlem gerekiyor: ${breakdownText}.`,
      impact: hasCritical
        ? "Kritik işlemlerin gecikmesi doğrudan arıza, maliyet artışı ve hizmet kesintisi riski taşır."
        : "Zamanında müdahale edilmezse bu uyarılar kritik seviyeye yükselebilir.",
      action: hasCritical
        ? "Önce kritik işlemleri tamamlayın, ardından diğer uyarıları ele alın."
        : "İşlemleri öncelik sırasına göre planlayın.",
      ctaLabel: hasCritical ? "Kritik İşlemleri Tamamla" : "İşlemleri Planla",
      escalationTier,
      breakdown,
    };
  }

  // --- Standard tier (single issue type) ---
  // Delegate to type-specific logic for richer detail
  switch (status.risk.type) {
    case "maintenance_due": {
      if (maxOverdueDays > 30) {
        return {
          severityLabel: "Kritik",
          title: `${overdueCount} Bakım Kritik Gecikme Seviyesinde`,
          description: overdueCount === 1
            ? `Bir bakım ${maxOverdueDays} gündür yapılmadı. Acil müdahale gerektirir.`
            : `${overdueCount} bakımdan en uzunu ${maxOverdueDays} gündür yapılmadı. Acil müdahale gereklidir.`,
          impact: "30 günü aşan bakım gecikmesi arıza olasılığını katlar ve onarım maliyetleri kontrol dışına çıkabilir.",
          action: "Tüm gecikmiş bakımları bugün planlayarak derhal tamamlayın.",
          ctaLabel: "Acil Bakım Başlat",
          escalationTier,
          breakdown,
        };
      }
      if (maxOverdueDays > 7) {
        return {
          severityLabel: "Kritik",
          title: `${overdueCount} Bakım Zamanında Yapılmadı`,
          description: overdueCount === 1
            ? `Planlanan bakım ${maxOverdueDays} gündür gecikmiş durumda.`
            : `${overdueCount} varlık için bakım ${maxOverdueDays} güne kadar gecikmiş durumda.`,
          impact: "Bir haftayı aşan gecikme arıza riskini ciddi şekilde artırır ve onarım maliyetleri yükselebilir.",
          action: "Gecikmiş bakımları en kısa sürede tamamlayın.",
          ctaLabel: "Gecikmiş Bakımları Tamamla",
          escalationTier,
          breakdown,
        };
      }
      return {
        severityLabel: overdueCount > 3 ? "Kritik" : "Uyarı",
        title: `${overdueCount} Bakım Gecikmeye Başladı`,
        description: `${overdueCount} bakım tarihi geçmiş durumda. Bugün planlayarak sorunu büyümeden çözebilirsiniz.`,
        impact: "Bakım geciktikçe performans düşer ve uzun vadede onarım maliyetleri artar.",
        action: "Bakım planını açarak gecikmiş işlemleri bugün zamanlayın.",
        ctaLabel: "Bugün Bakım Planla",
        escalationTier,
        breakdown,
      };
    }

    case "rule_missing":
      return {
        severityLabel: "Uyarı",
        title: "Bakım Kuralı Tanımlanmamış",
        description: "Varlıklarınız için henüz periyodik bakım kuralı oluşturulmamış.",
        impact: "Bakım kuralı olmadan olası arızalar fark edilemez ve plansız duruşlar yaşanabilir.",
        action: "En az bir periyodik bakım kuralı oluşturarak varlıklarınızı koruma altına alın.",
        ctaLabel: "Kural Oluştur",
        escalationTier,
        breakdown,
      };

    case "document_missing": {
      const maxDocDays = riskPanel.missingDocuments.reduce((max, i) => Math.max(max, i.daysWithoutDocument), 0);
      return {
        severityLabel: maxDocDays > 30 ? "Uyarı" : "Bilgi",
        title: `${docCount} Varlıkta Belge Eksik`,
        description: docCount === 1
          ? `Bir varlığa ${maxDocDays} gündür belge eklenmemiş.`
          : `${docCount} varlığa hiç belge eklenmemiş. En uzun eksiklik ${maxDocDays} gün.`,
        impact: "Eksik belgeler garanti başvurusu, sigorta talebi veya denetim süreçlerinde ciddi sorun yaratabilir.",
        action: "İlgili varlıklara garanti belgesi, fatura veya servis raporlarını yükleyin.",
        ctaLabel: maxDocDays > 30 ? "Hemen Belge Yükle" : "Belge Yükle",
        escalationTier,
        breakdown,
      };
    }

    case "invoice_due": {
      if (overduePmtCount > 0) {
        const maxPmtDays = riskPanel.upcomingPayments.reduce((max, i) => (i.daysRemaining < 0 ? Math.max(max, Math.abs(i.daysRemaining)) : max), 0);
        if (maxPmtDays > 30) {
          return {
            severityLabel: "Kritik",
            title: `${overduePmtCount} Ödeme Ciddi Gecikme Seviyesinde`,
            description: `${overduePmtCount} faturanın ödeme tarihi geçmiş. En uzun gecikme ${maxPmtDays} gün.`,
            impact: "30 günü aşan ödeme gecikmesi ek faiz, yüksek ceza ve hizmet kesintisi riskini ciddi şekilde artırır.",
            action: "Gecikmiş ödemeleri bugün tamamlayın.",
            ctaLabel: "Acil Ödeme Yap",
            escalationTier,
            breakdown,
          };
        }
        return {
          severityLabel: "Kritik",
          title: `${overduePmtCount} Ödeme Vadesi Geçti`,
          description: `${overduePmtCount} faturanın ödeme tarihi geçmiş durumda.`,
          impact: "Geciken ödemeler ek ücret, faiz veya hizmet kesintisine neden olabilir.",
          action: "Fatura detaylarını kontrol edin ve gecikmiş ödemeleri tamamlayın.",
          ctaLabel: "Gecikmiş Ödemeyi Yap",
          escalationTier,
          breakdown,
        };
      }
      return {
        severityLabel: "Uyarı",
        title: `${upcomingPmtCount || status.riskCount} Ödeme Yaklaşıyor`,
        description: `Faturanın ödeme tarihi yaklaşıyor. Zamanında ödeme yaparak gecikme riskinden kaçının.`,
        impact: "Zamanında ödeme yapılmaması ek ücret ve hizmet kesintisine yol açabilir.",
        action: "Fatura detaylarını kontrol edin ve ödeme planınızı güncelleyin.",
        ctaLabel: "Ödemeleri Kontrol Et",
        escalationTier,
        breakdown,
      };
    }

    case "notification_prefs":
    default:
      return {
        severityLabel: "Bilgi",
        title: "Bildirim Tercihleri",
        description: "Bildirim ayarlarınızı düzenleyerek önemli uyarıları zamanında alın.",
        impact: "Doğru yapılandırılmamış bildirimler kritik uyarıların gözden kaçmasına yol açabilir.",
        action: "Bildirim tercihlerinizi kontrol edin ve güncelleyin.",
        ctaLabel: "Tercihleri Düzenle",
        escalationTier,
        breakdown,
      };
  }
}
