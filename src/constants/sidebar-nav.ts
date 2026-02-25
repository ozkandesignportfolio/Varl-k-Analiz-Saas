export type SidebarNavKey =
  | "dashboard"
  | "assets"
  | "maintenance"
  | "services"
  | "documents"
  | "timeline"
  | "expenses"
  | "notifications"
  | "billing"
  | "invoices"
  | "costs"
  | "reports"
  | "settings";

export type SidebarNavIconKey =
  | "dashboard"
  | "package"
  | "wrench"
  | "folder-open"
  | "clock"
  | "hand-coins"
  | "bell"
  | "credit-card"
  | "receipt"
  | "trending-up"
  | "file-text"
  | "settings";

export type SidebarNavItem = {
  key: SidebarNavKey;
  label: string;
  href: string;
  iconKey: SidebarNavIconKey;
  shortCode: string;
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { key: "dashboard", label: "Gösterge", href: "/dashboard", iconKey: "dashboard", shortCode: "GS" },
  { key: "assets", label: "Varlıklar", href: "/assets", iconKey: "package", shortCode: "VR" },
  { key: "maintenance", label: "Bakım", href: "/maintenance", iconKey: "wrench", shortCode: "BK" },
  { key: "services", label: "Servisler", href: "/services", iconKey: "wrench", shortCode: "SR" },
  { key: "documents", label: "Belgeler", href: "/documents", iconKey: "folder-open", shortCode: "BG" },
  { key: "timeline", label: "Zaman Akışı", href: "/timeline", iconKey: "clock", shortCode: "ZA" },
  { key: "expenses", label: "Giderler", href: "/expenses", iconKey: "hand-coins", shortCode: "GD" },
  { key: "notifications", label: "Bildirimler", href: "/notifications", iconKey: "bell", shortCode: "BL" },
  { key: "billing", label: "Abonelikler", href: "/billing", iconKey: "credit-card", shortCode: "AB" },
  { key: "invoices", label: "Fatura Takip", href: "/invoices", iconKey: "receipt", shortCode: "FT" },
  { key: "costs", label: "Skor Analizi", href: "/costs", iconKey: "trending-up", shortCode: "SK" },
  { key: "reports", label: "Raporlar", href: "/reports", iconKey: "file-text", shortCode: "RP" },
  { key: "settings", label: "Ayarlar", href: "/settings", iconKey: "settings", shortCode: "AY" },
];

export const SIDEBAR_LABEL_BY_KEY = SIDEBAR_NAV_ITEMS.reduce<Record<SidebarNavKey, string>>(
  (acc, item) => {
    acc[item.key] = item.label;
    return acc;
  },
  {
    dashboard: "",
    assets: "",
    maintenance: "",
    services: "",
    documents: "",
    timeline: "",
    expenses: "",
    notifications: "",
    billing: "",
    invoices: "",
    costs: "",
    reports: "",
    settings: "",
  },
);
