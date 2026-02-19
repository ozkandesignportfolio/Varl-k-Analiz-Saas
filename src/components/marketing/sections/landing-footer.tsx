"use client";

import Link from "next/link";

const productLinks = [
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#fiyatlandirma", label: "Fiyatlandırma" },
  { href: "#sss", label: "SSS" },
  { href: "#sablonlar", label: "Şablonlar" },
];

const legalLinks = [
  { href: "/gizlilik-politikasi", label: "Gizlilik" },
  { href: "/kullanim-kosullari", label: "Kullanım Şartları" },
  { href: "/kvkk", label: "KVKK" },
  { href: "/security", label: "Güvenlik" },
];

const accountLinks = [
  { href: "/login", label: "Giriş" },
  { href: "/register", label: "Kayıt Ol" },
  { href: "/dashboard", label: "Panel" },
];

export default function LandingFooter() {
  return (
    <footer className="mt-8 border-t border-[#1E293B] bg-[#080D1A] px-6 py-8 sm:px-7">
      <div className="grid gap-6 md:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 text-xs font-semibold text-white">
              AC
            </span>
            <span className="text-sm font-semibold text-white">AssetCare</span>
          </Link>
          <p className="mt-3 text-sm text-slate-300">Bakım, garanti ve servis süreçlerinde tek kontrol merkezi.</p>
          <p className="mt-3 text-xs text-slate-400">© 2026 AssetCare</p>
        </div>

        <FooterColumn title="Ürün" links={productLinks} />
        <FooterColumn title="Hukuki" links={legalLinks} />
        <FooterColumn title="Hesap" links={accountLinks} />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-slate-300 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
