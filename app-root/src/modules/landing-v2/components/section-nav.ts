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
    label: "Product",
    links: [
      { label: "Features", href: "#ozellikler" },
      { label: "Pricing", href: "#fiyatlandirma" },
      { label: "Notifications", href: "#bildirimler" },
      { label: "Score Analysis", href: "#skor-analizi" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "KVKK", href: "/legal/kvkk" },
      { label: "Cookie Policy", href: "/legal/cookies" },
      { label: "Legal Notice", href: "/legal/notice" },
    ],
  },
];

export const LANDING_NAV_SECTIONS = [
  { label: "Features", href: "#ozellikler" },
  { label: "SaaS Dashboard", href: "#panel" },
  { label: "Notifications", href: "#bildirimler" },
  { label: "Subscriptions", href: "#abonelik" },
  { label: "Invoices", href: "#fatura" },
  { label: "Score Analysis", href: "#skor-analizi" },
  { label: "Pricing", href: "#fiyatlandirma" },
] as const;

type LandingSectionHash = (typeof LANDING_NAV_SECTIONS)[number]["href"];

export const isLandingSectionHash = (value: string): value is LandingSectionHash =>
  LANDING_NAV_SECTIONS.some((section) => section.href === value);
