export type NavLink = {
  label: string;
  href: string;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ürün",
    links: [
      { label: "Özellikler", href: "#ozellikler" },
      { label: "Fiyatlandırma", href: "#fiyatlandirma" },
      { label: "Bildirimler", href: "#bildirimler" },
      { label: "Skor Analizi", href: "#skor-analizi" },
    ],
  },
  {
    label: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/about" },
      { label: "İletişim", href: "/contact" },
    ],
  },
  {
    label: "Yasal",
    links: [
      { label: "Gizlilik Politikası", href: "/legal/privacy" },
      { label: "Kullanım Şartları", href: "/legal/terms" },
      { label: "KVKK", href: "/legal/kvkk" },
      { label: "Çerez Politikası", href: "/legal/cookies" },
      { label: "Hukuki Bilgilendirme", href: "/legal/notice" },
    ],
  },
];

export const LANDING_NAV_SECTIONS = [
  { label: "Özellikler", href: "#ozellikler" },
  { label: "SaaS Paneli", href: "#panel" },
  { label: "Bildirimler", href: "#bildirimler" },
  { label: "Abonelik Takibi", href: "#abonelik" },
  { label: "SaaS Faturaları", href: "#fatura" },
  { label: "Skor Analizi", href: "#skor-analizi" },
  { label: "Fiyatlandırma", href: "#fiyatlandirma" },
] as const;

type LandingSectionHash = (typeof LANDING_NAV_SECTIONS)[number]["href"];

export const isLandingSectionHash = (value: string): value is LandingSectionHash =>
  LANDING_NAV_SECTIONS.some((section) => section.href === value);
