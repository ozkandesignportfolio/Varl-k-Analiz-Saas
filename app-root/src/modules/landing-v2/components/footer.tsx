import Link from "next/link";
import { PAYMENT_TEXT } from "@/constants/ui-text";

type FooterLink = {
  label: string;
  href: string;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

const footerGroups: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#ozellikler" },
      { label: "Pricing", href: "/#fiyatlandirma" },
      { label: "Notifications", href: "/#bildirimler" },
      { label: "Score Analysis", href: "/#skor-analizi" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "KVKK", href: "/legal/kvkk" },
      { label: "Cookie Policy", href: "/legal/cookies" },
      { label: "Legal Notice", href: "/legal/notice" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/30">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-foreground">ASSETLY</div>
                <div className="text-[9px] tracking-widest text-muted-foreground">SaaS Cost Control</div>
              </div>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Track your team’s SaaS subscriptions, identify unused tools and take control of software costs.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-sm font-semibold text-foreground">{group.title}</h4>
              <div className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-border/30 pt-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground/70">{PAYMENT_TEXT.stripeCollectionNotice}</p>
          <p className="text-sm text-muted-foreground">2026 Assetly. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
