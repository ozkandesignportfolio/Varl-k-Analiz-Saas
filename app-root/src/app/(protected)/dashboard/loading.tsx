export default function DashboardLoading() {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl animate-pulse space-y-5">
        <section className="rounded-2xl border border-[#1E293B] bg-[#0E1525] p-6">
          <div className="h-6 w-36 rounded bg-slate-700/60" />
          <div className="mt-3 h-4 w-56 rounded bg-slate-700/40" />
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="h-10 w-32 rounded-lg bg-slate-700/45" />
            <div className="h-10 w-36 rounded-lg bg-slate-700/45" />
            <div className="h-10 w-28 rounded-lg bg-slate-700/45" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-4">
              <div className="h-3 w-24 rounded bg-slate-700/50" />
              <div className="mt-3 h-8 w-20 rounded bg-slate-700/60" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-700/45" />
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
          <div className="h-4 w-24 rounded bg-slate-700/50" />
          <div className="mt-4 h-6 w-44 rounded bg-slate-700/55" />
          <div className="mt-4 grid gap-4 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-[#1E293B] bg-[#0B1324] p-4">
                <div className="h-4 w-36 rounded bg-slate-700/50" />
                <div className="mt-3 h-28 rounded bg-slate-700/35" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5 xl:col-span-7">
            <div className="h-4 w-28 rounded bg-slate-700/50" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 rounded-lg bg-slate-700/35" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5 xl:col-span-5">
            <div className="h-4 w-24 rounded bg-slate-700/50" />
            <div className="mx-auto mt-5 h-40 w-40 rounded-full bg-slate-700/35" />
            <div className="mt-4 space-y-2">
              <div className="h-10 rounded bg-slate-700/35" />
              <div className="h-10 rounded bg-slate-700/35" />
              <div className="h-10 rounded bg-slate-700/35" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#1E293B] bg-[#0E1525] p-5">
          <div className="h-4 w-24 rounded bg-slate-700/50" />
          <div className="mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-40 w-48 shrink-0 rounded-xl bg-slate-700/35" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
