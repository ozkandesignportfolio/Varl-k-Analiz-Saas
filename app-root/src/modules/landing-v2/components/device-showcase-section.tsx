"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useInView } from "@/modules/landing-v2/hooks/use-in-view";
import {
  Box,
  Wrench,
  FileText,
  Clock,
  Bell,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Settings,
} from "lucide-react";

// Sidebar menu items matching the exact Assetly menu
const sidebarItems = [
  { icon: Box, label: "Varlıklar", badge: "12" },
  { icon: Wrench, label: "Bakım", badge: "4" },
  { icon: Settings, label: "Servis Kayıtları", badge: "8" },
  { icon: FileText, label: "Belgeler", badge: "23" },
  { icon: Clock, label: "Zaman Akışı", badge: "" },
  { icon: CreditCard, label: "Giderler", badge: "₺" },
  { icon: Bell, label: "Bildirimler", badge: "3" },
  { icon: CreditCard, label: "Abonelikler", badge: "5" },
];

// Sample assets for the dashboard
const sampleAssets = [
  { name: "Klima", location: "Ofis - Kat 2", status: "warning", statusText: "3 gün içinde bakım gerekli" },
  { name: "Dizüstü Bilgisayar", location: "IT Departmanı", status: "ok", statusText: "Aktif" },
  { name: "Yazıcı", location: "Resepsiyon", status: "ok", statusText: "Aktif" },
  { name: "Sunucu", location: "Veri Merkezi", status: "ok", statusText: "Aktif" },
];

function LaptopScreen() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-[4px] bg-[#0a1128]">
      {/* Sidebar */}
      <aside className="hidden w-[180px] shrink-0 flex-col border-r border-white/5 bg-[#070e1f] p-3 md:flex">
        {/* Brand */}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0d1a33]/80 to-[#0a1428]/60 p-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#10efb5]/20 to-[#2cf7ff]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <img src="/assetly-mark.svg" alt="" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/90">ASSETLY</p>
            <p className="text-[7px] tracking-wider text-white/40">Kontrol Merkezi</p>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-0.5">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === 0;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[10px] transition-colors",
                  isActive
                    ? "bg-[#10efb5]/10 text-[#10efb5]"
                    : "text-white/50 hover:bg-white/5 hover:text-white/70"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3 w-3" />
                  <span className="font-medium">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px]">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a1428]/50 px-4">
          <div>
            <p className="text-[8px] text-white/40">Panel / Varlıklar</p>
            <h3 className="text-[11px] font-semibold text-white">Varlık Listesi</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-white/5">
              <Bell className="h-3 w-3 text-white/60" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#10efb5]" />
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-3">
          {/* Warning Alert */}
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-[9px] font-medium text-amber-200">
              Klima → 3 gün içinde bakım gerekli
            </p>
            <ChevronRight className="ml-auto h-3 w-3 text-amber-400" />
          </div>

          {/* Asset Table */}
          <div className="rounded-lg border border-white/5 bg-[#0d1a33]/50">
            <div className="grid grid-cols-3 gap-2 border-b border-white/5 px-3 py-2 text-[8px] font-medium uppercase tracking-wider text-white/40">
              <span>Varlık Adı</span>
              <span>Konum</span>
              <span>Durum</span>
            </div>
            {sampleAssets.map((asset) => (
              <div
                key={asset.name}
                className="grid grid-cols-3 gap-2 border-b border-white/5 px-3 py-2 last:border-0"
              >
                <span className="text-[9px] font-medium text-white/90">{asset.name}</span>
                <span className="text-[9px] text-white/50">{asset.location}</span>
                <span
                  className={cn(
                    "text-[9px] font-medium",
                    asset.status === "warning" ? "text-amber-400" : "text-[#10efb5]"
                  )}
                >
                  {asset.statusText}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function PhoneScreen() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-[#0a1128]">
      {/* Status Bar */}
      <div className="flex h-6 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-[8px] font-medium text-white/60">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-1.5 w-0.5 rounded-full bg-white/60" />
            ))}
          </div>
          <div className="ml-1 h-2 w-4 rounded-sm border border-white/60">
            <div className="h-full w-3/4 rounded-sm bg-white/60" />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#10efb5]/20 to-[#2cf7ff]/20">
          <img src="/assetly-mark.svg" alt="" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-semibold text-white">Varlık Detayı</p>
          <p className="text-[9px] text-white/40">Klima - Ofis Kat 2</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {/* Status Card */}
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Dikkat
            </span>
          </div>
          <p className="text-[11px] font-medium text-amber-200">
            Bakım süresi yaklaşıyor
          </p>
          <p className="mt-1 text-[10px] text-amber-200/60">
            Son bakım: 15 Ocak 2024
          </p>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[9px] uppercase tracking-wider text-white/40">Kategori</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/90">HVAC Sistemleri</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[9px] uppercase tracking-wider text-white/40">Garanti Durumu</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#10efb5]">Aktif - 8 ay kaldı</p>
          </div>
        </div>

        {/* CTA Button */}
        <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#10efb5] to-[#2cf7ff] py-3 text-[11px] font-semibold text-[#0a1128] shadow-[0_8px_20px_rgba(16,239,181,0.25)]">
          Bakımı planla
        </button>
      </div>

      {/* Home Indicator */}
      <div className="flex justify-center pb-2">
        <div className="h-1 w-24 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

export function DeviceShowcaseSection() {
  const { ref, inView } = useInView(0.1);

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden py-24 lg:py-32"
    >
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gradient glow behind devices */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(16,239,181,0.08)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(44,247,255,0.06)_0%,transparent_70%)] blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text Content */}
          <div
            className={cn(
              "order-2 lg:order-1",
              inView ? "animate-slide-in-left" : "opacity-0"
            )}
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#10efb5]">
              Tam Kontrol
            </p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Varlıklarını sadece yönetme,{" "}
              <span className="bg-gradient-to-r from-[#10efb5] to-[#2cf7ff] bg-clip-text text-transparent">
                kontrol altına al.
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tüm cihazlarını, bakım süreçlerini ve aboneliklerini tek bir panelde
              takip et. Kritik uyarıları kaçırma, operasyonlarını sadeleştir.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#10efb5] to-[#2cf7ff] px-7 py-3.5 text-sm font-semibold text-[#0a1128] shadow-[0_10px_30px_rgba(16,239,181,0.25)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_14px_40px_rgba(16,239,181,0.35)]"
              >
                Ücretsiz başla
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                Demo incele
              </Link>
            </div>
          </div>

          {/* Device Scene */}
          <div
            className={cn(
              "order-1 lg:order-2",
              inView ? "animate-slide-up" : "opacity-0"
            )}
          >
            <div
              className="relative mx-auto w-full max-w-[600px]"
              style={{ perspective: "1200px" }}
            >
              {/* Laptop Device */}
              <div
                className="device-laptop relative animate-float"
                style={{
                  transform: "rotateY(-8deg) rotateX(2deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Laptop Screen */}
                <div className="relative overflow-hidden rounded-t-[12px] border-[8px] border-[#1a1a1a] bg-[#1a1a1a] shadow-[0_-4px_30px_rgba(0,0,0,0.4),0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]">
                  {/* Screen Bezel */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[4px] bg-[#0a1128]">
                    {/* Screen Content */}
                    <LaptopScreen />

                    {/* Screen Reflection */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />
                  </div>

                  {/* Webcam */}
                  <div className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#2a2a2a]">
                    <div className="absolute inset-0.5 rounded-full bg-[#1a1a1a]" />
                  </div>
                </div>

                {/* Laptop Base */}
                <div className="relative h-3 rounded-b-lg bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                  {/* Notch */}
                  <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-lg bg-[#3a3a3a]" />
                </div>

                {/* Laptop Bottom */}
                <div
                  className="h-1 rounded-b-xl bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]"
                  style={{
                    transform: "rotateX(-90deg) translateY(-2px)",
                    transformOrigin: "top",
                  }}
                />

                {/* Laptop Shadow */}
                <div className="absolute -bottom-8 left-1/2 h-4 w-[90%] -translate-x-1/2 rounded-full bg-black/30 blur-xl" />
              </div>

              {/* Phone Device */}
              <div
                className="device-phone absolute -bottom-4 -right-4 z-10 animate-float-delay sm:right-4 md:-right-8 lg:-right-12"
                style={{
                  transform: "rotateY(5deg) rotateX(-2deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="relative h-[280px] w-[140px] overflow-hidden rounded-[28px] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_10px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] sm:h-[320px] sm:w-[160px]">
                  {/* Dynamic Island */}
                  <div className="absolute left-1/2 top-2 z-10 h-5 w-16 -translate-x-1/2 rounded-full bg-black" />

                  {/* Screen Content */}
                  <PhoneScreen />

                  {/* Screen Reflection */}
                  <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />
                </div>

                {/* Phone Shadow */}
                <div className="absolute -bottom-6 left-1/2 h-3 w-[80%] -translate-x-1/2 rounded-full bg-black/25 blur-lg" />
              </div>

              {/* Decorative Elements */}
              <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-[#10efb5]/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-[#2cf7ff]/10 blur-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}

export default DeviceShowcaseSection;
