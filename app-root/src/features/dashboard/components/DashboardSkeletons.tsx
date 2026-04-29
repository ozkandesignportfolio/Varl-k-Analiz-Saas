"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export const Skeleton = memo(function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/[0.06]",
        className,
      )}
    />
  );
});

export const KPICardSkeleton = memo(function KPICardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-9 w-28" />
      <Skeleton className="mt-2 h-3 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
      <Skeleton className="mt-4 h-3 w-16" />
    </div>
  );
});

export const KPICardsSkeleton = memo(function KPICardsSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    </section>
  );
});

export const QuickActionsSkeleton = memo(function QuickActionsSkeleton() {
  return (
    <section className="space-y-3">
      <Skeleton className="h-6 w-36" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-[#29405E] bg-[linear-gradient(145deg,rgba(13,27,52,0.9),rgba(10,19,37,0.84))] p-4">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="mt-4 h-5 w-28" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-4 h-3 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
});

export const RiskPanelSkeleton = memo(function RiskPanelSkeleton() {
  return (
    <article className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(150deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
});

export const RecentActivitySkeleton = memo(function RecentActivitySkeleton() {
  return (
    <section className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(145deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-44" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

export const ControlCenterHeaderSkeleton = memo(function ControlCenterHeaderSkeleton() {
  return (
    <section className="rounded-3xl border border-[#24344F] bg-[linear-gradient(145deg,rgba(8,20,45,0.92),rgba(9,17,33,0.84))] p-5 shadow-[0_20px_45px_rgba(3,8,20,0.42)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
    </section>
  );
});
