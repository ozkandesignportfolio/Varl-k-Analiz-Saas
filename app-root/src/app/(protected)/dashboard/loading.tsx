export default function DashboardLoading() {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* ControlCenterHeader skeleton */}
        <section className="animate-pulse rounded-3xl border border-[#24344F] bg-[linear-gradient(145deg,rgba(8,20,45,0.92),rgba(9,17,33,0.84))] p-5 shadow-[0_20px_45px_rgba(3,8,20,0.42)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-7 w-28 rounded-full bg-white/[0.06]" />
                <div className="h-7 w-32 rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-8 w-56 rounded bg-white/[0.06]" />
              <div className="h-4 w-96 max-w-full rounded bg-white/[0.04]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-10 w-64 rounded-xl bg-white/[0.04]" />
              <div className="h-10 w-28 rounded-xl bg-white/[0.04]" />
            </div>
          </div>
        </section>

        {/* KPI Cards skeleton */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="h-5 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(15,25,50,0.85),rgba(10,18,35,0.75))] p-5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-white/[0.06]" />
                  <div className="size-8 rounded-lg bg-white/[0.04]" />
                </div>
                <div className="mt-6 h-9 w-28 rounded bg-white/[0.06]" />
                <div className="mt-2 h-3 w-32 rounded bg-white/[0.04]" />
                <div className="mt-4 h-3 w-16 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </section>

        {/* QuickActions skeleton */}
        <section className="space-y-3">
          <div className="h-6 w-36 animate-pulse rounded bg-white/[0.06]" />
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#29405E] bg-[linear-gradient(145deg,rgba(13,27,52,0.9),rgba(10,19,37,0.84))] p-4">
                <div className="size-9 rounded-xl bg-white/[0.06]" />
                <div className="mt-4 h-5 w-28 rounded bg-white/[0.06]" />
                <div className="mt-2 h-4 w-full rounded bg-white/[0.04]" />
                <div className="mt-4 h-3 w-20 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </section>

        {/* Risks + Usage skeleton */}
        <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <div className="space-y-3">
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(150deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-6 w-40 rounded bg-white/[0.06]" />
                    <div className="h-6 w-16 rounded-full bg-white/[0.04]" />
                  </div>
                  <div className="space-y-2.5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="flex items-start gap-3 rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
                        <div className="size-8 rounded-lg bg-white/[0.06]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                          <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="animate-pulse rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(165deg,rgba(10,22,44,0.95),rgba(11,18,35,0.88))] p-5">
            <div className="h-4 w-20 rounded bg-white/[0.06]" />
            <div className="mt-2 h-6 w-28 rounded bg-white/[0.06]" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[#314866] bg-[#0F1E37]/75 p-3">
                  <div className="h-4 w-full rounded bg-white/[0.06]" />
                  <div className="mt-2 h-2 rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RecentActivity skeleton */}
        <section className="animate-pulse rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(145deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="h-6 w-28 rounded bg-white/[0.06]" />
              <div className="mt-2 h-4 w-44 rounded bg-white/[0.04]" />
            </div>
            <div className="h-8 w-28 rounded-lg bg-white/[0.04]" />
          </div>
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
                <div className="size-8 rounded-lg bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
