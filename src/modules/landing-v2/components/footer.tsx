"use client"

import { Shield } from "lucide-react"

const footerLinks = [
  {
    title: "Ürün",
    links: ["Özellikler", "Fiyatlandırma", "Bildirimler", "Skor Analizi"],
  },
  {
    title: "Çözümler",
    links: ["Varlık Takibi", "Abonelik Yönetimi", "Fatura Takibi", "Bakım Motoru"],
  },
  {
    title: "Şirket",
    links: ["Hakkımızda", "Blog", "Kariyer", "İletişim"],
  },
  {
    title: "Yasal",
    links: ["Gizlilik Politikası", "Kullanım Şartları", "KVKK"],
  },
]

export function Footer() {
  return (
    <footer className="relative border-t border-border/30">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-foreground">ASSETCARE</div>
                <div className="text-[9px] tracking-widest text-muted-foreground">Premium Panel</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Varlıklarınızı akıllı yönetin, riskleri önleyin.
            </p>
          </div>

          {/* Links */}
          {footerLinks.map((group, i) => (
            <div key={i}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{group.title}</h4>
              <div className="flex flex-col gap-2.5">
                {group.links.map((link, j) => (
                  <a
                    key={j}
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-border/30 pt-8">
          <p className="text-sm text-muted-foreground">2026 AssetCare. Tüm haklar saklıdır.</p>
        </div>
      </div>
    </footer>
  )
}
