export const LANDING_NAV_SECTIONS = [
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Panel Önizleme", href: "#panel" },
  { label: "Bildirimler", href: "#bildirimler" },
  { label: "Abonelik Takibi", href: "#abonelik" },
  { label: "Fatura Takip", href: "#fatura" },
  { label: "Skor Analizi", href: "#skor-analizi" },
  { label: "Fiyatlandırma", href: "#fiyatlandirma" },
] as const;

type LandingSectionHash = (typeof LANDING_NAV_SECTIONS)[number]["href"];

export const isLandingSectionHash = (value: string): value is LandingSectionHash =>
  LANDING_NAV_SECTIONS.some((section) => section.href === value);
