export const LANDING_NAV_SECTIONS = [
  { label: "Özellikler", href: "#features" },
  { label: "Panel Önizleme", href: "#panel" },
  { label: "Bildirimler", href: "#bildirim" },
  { label: "Abonelik Takibi", href: "#abonelik" },
  { label: "Fatura Takip", href: "#fatura" },
  { label: "Skor Analizi", href: "#skor" },
  { label: "Fiyatlandırma", href: "#pricing" },
] as const

type LandingSectionHash = (typeof LANDING_NAV_SECTIONS)[number]["href"]

export const isLandingSectionHash = (value: string): value is LandingSectionHash =>
  LANDING_NAV_SECTIONS.some((section) => section.href === value)
