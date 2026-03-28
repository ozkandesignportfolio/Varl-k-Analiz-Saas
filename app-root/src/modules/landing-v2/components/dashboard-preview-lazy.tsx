"use client";

import dynamic from "next/dynamic";

export const DashboardPreviewLazy = dynamic(
  () => import("./dashboard-preview").then((module) => module.DashboardPreview),
  {
    ssr: false,
    loading: () => <DashboardPreviewFallback />,
  }
);

function DashboardPreviewFallback() {
  return (
    <section id="panel" className="relative isolate py-32">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">Premium Kontrol Paneli</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Güçlü kontrol paneli, <span className="text-gradient">tek bakışta</span>
          </h2>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[rgba(53,80,113,0.72)] bg-[rgb(7_14_32_/_72%)] p-6 shadow-[0_24px_70px_rgb(5_10_24_/_56%)]">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="h-10 rounded-xl bg-white/[0.06]" />
              <div className="h-10 rounded-xl bg-white/[0.05]" />
              <div className="h-10 rounded-xl bg-white/[0.04]" />
              <div className="h-10 rounded-xl bg-white/[0.04]" />
            </div>
            <div className="space-y-4">
              <div className="h-16 rounded-2xl bg-white/[0.05]" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-28 rounded-2xl bg-white/[0.04]" />
                <div className="h-28 rounded-2xl bg-white/[0.04]" />
              </div>
              <div className="h-48 rounded-2xl bg-white/[0.03]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
