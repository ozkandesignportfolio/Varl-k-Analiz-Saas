import {
  Bell,
  Clock3,
  CreditCard,
  FileText,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SIDEBAR_NAV_ITEMS, type SidebarNavIconKey } from "@/constants/sidebar-nav";
import type {
  PreviewListMenuKey,
  PreviewMenuItem,
  PreviewMenuKey,
  PreviewTheme,
  RowItem,
} from "@/modules/landing-v2/components/panel-preview/types";

const LANDING_PREVIEW_MENU_KEYS: PreviewMenuKey[] = [
  "dashboard",
  "assets",
  "maintenance",
  "services",
  "documents",
  "timeline",
  "expenses",
  "notifications",
  "billing",
  "invoices",
  "costs",
  "reports",
];

export const previewThemeVars: PreviewTheme = {
  ["--auth-bg" as string]: "#050a18",
  ["--auth-sidebar-bg" as string]: "#070e20",
  ["--auth-foreground" as string]: "#e8ecf4",
  ["--auth-muted" as string]: "#90a3d0",
  ["--auth-surface" as string]: "rgb(10 17 40 / 68%)",
  ["--auth-surface-strong" as string]: "rgb(10 17 40 / 84%)",
  ["--auth-border" as string]: "rgb(35 58 100 / 62%)",
  ["--auth-border-soft" as string]: "rgb(35 58 100 / 45%)",
  ["--auth-primary" as string]: "#10efb5",
  ["--auth-accent" as string]: "#2cf7ff",
  ["--auth-ring" as string]: "rgb(16 239 181 / 62%)",
  ["--auth-sidebar-width" as string]: "16rem",
};

const iconBySidebarKey: Record<SidebarNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  package: Package,
  wrench: Wrench,
  "folder-open": FolderOpen,
  clock: Clock3,
  "hand-coins": HandCoins,
  bell: Bell,
  "credit-card": CreditCard,
  receipt: Receipt,
  "trending-up": TrendingUp,
  "file-text": FileText,
  settings: Settings,
};

const previewContentByMenuKey: Record<PreviewMenuKey, Pick<PreviewMenuItem, "title" | "subtitle">> = {
  dashboard: {
    title: "Kontrol Merkezi",
    subtitle: "Özet metrikler, hızlı aksiyonlar ve risk paneli",
  },
  assets: {
    title: "Varlıklar",
    subtitle: "Envanter durumları ve maliyet özeti",
  },
  maintenance: {
    title: "Bakım",
    subtitle: "Bakım kuralları ve yaklaşan tarihler",
  },
  services: {
    title: "Servis Kayıtları",
    subtitle: "Servis kayıtları, tarih ve tutar",
  },
  documents: {
    title: "Belgeler",
    subtitle: "Belge durumu ve doğrulama akışı",
  },
  timeline: {
    title: "Zaman Akışı",
    subtitle: "Son aktiviteler ve olay günlüğü",
  },
  expenses: {
    title: "Giderler",
    subtitle: "Kategori bazlı son harcamalar",
  },
  notifications: {
    title: "Bildirimler",
    subtitle: "Öncelik düzeyine göre aktif bildirimler",
  },
  billing: {
    title: "Abonelikler",
    subtitle: "Plan, yenileme ve ücret görünümü",
  },
  invoices: {
    title: "Fatura Takip",
    subtitle: "Son ödeme tarihi ve durum kontrolü",
  },
  costs: {
    title: "Skor Analizi",
    subtitle: "Kategori skorları ve etki düzeyi",
  },
  reports: {
    title: "Raporlar",
    subtitle: "Hazır PDF raporlar ve oluşturma tarihi",
  },
  settings: {
    title: "Ayarlar",
    subtitle: "Profil, güvenlik ve plan tercihleri",
  },
};

export const previewMenuItems = SIDEBAR_NAV_ITEMS.filter((item) => LANDING_PREVIEW_MENU_KEYS.includes(item.key)).map(
  (item) => ({
    key: item.key,
    label: item.label,
    badge: item.shortCode,
    icon: iconBySidebarKey[item.iconKey],
    ...previewContentByMenuKey[item.key],
  }),
);

export const rowDataByMenu: Record<PreviewListMenuKey, RowItem[]> = {
  assets: [
    { title: "Jeneratör A1", detail: "Elektrik • Aktif", badge: "92", date: "17 Şubat 2026", amount: "2.180 TL" },
    { title: "Klima B3", detail: "HVAC • Bakım Yakın", badge: "76", date: "09 Şubat 2026", amount: "1.450 TL" },
    { title: "Pompa C7", detail: "Mekanik • Aktif", badge: "84", date: "02 Şubat 2026", amount: "1.220 TL" },
  ],
  maintenance: [
    { title: "Aylık Periyodik", detail: "Jeneratör A1", badge: "Kritik", date: "28 Şubat 2026", amount: "1.980 TL" },
    { title: "Filtre Değişimi", detail: "Klima B3", badge: "Uyarı", date: "03 Mart 2026", amount: "1.250 TL" },
    { title: "Titreşim Kontrol", detail: "Pompa C7", badge: "Plan", date: "08 Mart 2026", amount: "860 TL" },
  ],
  services: [
    { title: "Yağ ve filtre değişimi", detail: "TeknikServ A.Ş.", badge: "Tamamlandı", date: "17 Şubat 2026", amount: "2.180 TL" },
    { title: "Gaz basıncı kontrolü", detail: "Serin Teknik", badge: "Tamamlandı", date: "09 Şubat 2026", amount: "1.450 TL" },
    { title: "Mil hizalama", detail: "Mekanik Destek", badge: "Bekliyor", date: "02 Şubat 2026", amount: "1.220 TL" },
  ],
  documents: [
    { title: "Bakım Sözleşmesi.pdf", detail: "PDF", badge: "Onaylandı", date: "20 Şubat 2026", amount: "12 MB" },
    { title: "Garanti Belgesi.jpg", detail: "Görsel", badge: "Kontrol", date: "18 Şubat 2026", amount: "3 MB" },
    { title: "Servis Raporu.docx", detail: "Belge", badge: "Onaylandı", date: "12 Şubat 2026", amount: "1 MB" },
  ],
  timeline: [
    { title: "Servis kaydı tamamlandı", detail: "Jeneratör A1 periyodik servis", badge: "09:40", date: "Bugün", amount: "2.180 TL" },
    { title: "Yeni belge yüklendi", detail: "Garanti Belgesi.jpg", badge: "08:25", date: "Bugün", amount: "Belge" },
    { title: "Bakım kuralı tetiklendi", detail: "Klima B3 için 7 gün kaldı", badge: "Dün", date: "Dün", amount: "Uyarı" },
  ],
  expenses: [
    { title: "Filtre Değişimi", detail: "Operasyon", badge: "Bakım", date: "18 Şubat", amount: "2.100 TL" },
    { title: "Periyodik Servis", detail: "Bakım", badge: "Servis", date: "11 Şubat", amount: "4.850 TL" },
    { title: "Parça Yenileme", detail: "Acil", badge: "Parça", date: "03 Şubat", amount: "11.790 TL" },
  ],
  notifications: [
    { title: "Bakım gecikmesi", detail: "Pompa C7 bakımı 2 gün gecikti", badge: "Kritik", date: "Bugün 10:12", amount: "Aksiyon" },
    { title: "Fatura son tarihi yaklaşıyor", detail: "Elektrik aboneliği için 4 gün kaldı", badge: "Uyarı", date: "Bugün 08:05", amount: "Hatırlat" },
    { title: "Skor artışı", detail: "Bu hafta genel sağlık skoru +5", badge: "Bilgi", date: "Dün 16:40", amount: "+5" },
  ],
  billing: [
    { title: "Premium Aylık", detail: "Aktif Plan", badge: "Aylık", date: "12 Nisan 2026", amount: "199 TL" },
    { title: "SMS Paketi", detail: "Ek Paket", badge: "Yenileme", date: "01 Mart 2026", amount: "1.250 TL" },
    { title: "Bulut Yedekleme", detail: "Ek Paket", badge: "Yenileme", date: "06 Mart 2026", amount: "890 TL" },
  ],
  invoices: [
    { title: "Elektrik Aboneliği", detail: "Son tarih yaklaşıyor", badge: "Yaklaşıyor", date: "01 Mart 2026", amount: "1.480 TL" },
    { title: "Bakım Anlaşması", detail: "Planlandı", badge: "Plan", date: "05 Mart 2026", amount: "3.250 TL" },
    { title: "Yedek Parça", detail: "Gecikmede", badge: "Gecikme", date: "20 Şubat 2026", amount: "980 TL" },
  ],
  costs: [
    { title: "Bakım Uyum", detail: "Kategori skoru", badge: "82", date: "Bugün", amount: "Orta Etki" },
    { title: "Belge Tamamlılık", detail: "Kategori skoru", badge: "74", date: "Dün", amount: "Yüksek Etki" },
    { title: "Ödeme Disiplini", detail: "Kategori skoru", badge: "91", date: "Bugün", amount: "Düşük Etki" },
  ],
  reports: [
    { title: "Aylık Bakım Raporu", detail: "Şubat 2026", badge: "PDF", date: "25 Şubat 2026", amount: "Hazır" },
    { title: "Gider Dağılım Raporu", detail: "Son 30 Gün", badge: "PDF", date: "24 Şubat 2026", amount: "Hazır" },
    { title: "Skor Trend Raporu", detail: "Haftalık", badge: "PDF", date: "23 Şubat 2026", amount: "Hazır" },
  ],
  settings: [
    { title: "Profil Bilgileri", detail: "Osman Yılmaz", badge: "Güncel", date: "21 Şubat 2026", amount: "Profil" },
    { title: "Plan Yönetimi", detail: "Premium Aylık", badge: "Aktif", date: "18 Şubat 2026", amount: "Plan" },
    { title: "Güvenlik", detail: "2FA Aktif", badge: "Güvenli", date: "17 Şubat 2026", amount: "Ayar" },
  ],
};
