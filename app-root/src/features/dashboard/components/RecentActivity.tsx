"use client";

import Link from "next/link";
import { ArrowRight, FileText, Receipt, Sparkles, TimerReset, Wrench } from "lucide-react";
import { FadeInUp, StaggerContainer, StaggerItem } from "@/features/dashboard/components/DashboardAnimations";
import type { DashboardActivityItem } from "@/features/dashboard/api/dashboard-shared";

type RecentActivityProps = {
  activities: DashboardActivityItem[];
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ACTIVITY_ICON: Record<DashboardActivityItem["type"], typeof Wrench> = {
  service: Wrench,
  document: FileText,
  rule: Sparkles,
  payment: Receipt,
};

export function RecentActivity({ activities }: RecentActivityProps) {
  const items = activities.slice(0, 10);

  return (
    <FadeInUp delay={0.1}>
      <section className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(145deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Sistem Akışı</h2>
            <p className="mt-1 text-sm text-[#9FB2CE]">Son 10 aktivite anlık görünüm</p>
          </div>
          <Link
            href="/timeline"
            className="inline-flex items-center gap-1 rounded-lg border border-[#3A567A] bg-[#132B4B] px-3 py-1.5 text-xs font-semibold text-[#DCEAFF] transition hover:bg-[#1A3B67]"
          >
            Zaman Akışı
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#314866] bg-[#0E1E37]/75 px-4 py-6 text-center">
            <span className="mx-auto inline-flex rounded-lg border border-[#35517A] bg-[#122846] p-2 text-[#C1D7F5]">
              <TimerReset className="size-4" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#F8FAFC]">Henüz aktivite kaydı yok</p>
            <p className="mt-2 text-sm text-[#9FB2CE]">
              Varlık ekleyerek bildirim ve görünüm almaya başlayın.
            </p>
          </div>
        ) : (
          <StaggerContainer className="mt-4 space-y-2.5" staggerDelay={0.04}>
            {items.map((item) => {
              const Icon = ACTIVITY_ICON[item.type];
              const safeDate = safeParseDateString(item.date);

              return (
                <StaggerItem key={item.id}>
                  <li className="list-none rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3 transition-colors duration-150 hover:border-[#3D5A7E] hover:bg-[#0E1E37]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex rounded-lg border border-[#35517A] bg-[#122846] p-1.5 text-[#C1D7F5]">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#EAF2FF]">{item.title}</p>
                          <p className="mt-1 text-xs text-[#9FB2CE]">{item.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#9FB2CE]">
                          {safeDate ? DATE_TIME_FORMATTER.format(safeDate) : "—"}
                        </span>
                        <Link
                          href={item.href}
                          className="inline-flex rounded-lg border border-[#3A567A] bg-[#132B4B] px-2.5 py-1 text-xs font-semibold text-[#DCEAFF] transition hover:bg-[#1A3B67]"
                        >
                          Git
                        </Link>
                      </div>
                    </div>
                  </li>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </section>
    </FadeInUp>
  );
}

const safeParseDateString = (value: string): Date | null => {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

