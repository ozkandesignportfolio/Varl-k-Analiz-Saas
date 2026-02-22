type MaintenanceHeaderProps = {
  onCreateRule: () => void;
};

export function MaintenanceHeader({ onCreateRule }: MaintenanceHeaderProps) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-5 py-5 shadow-[0_14px_30px_rgba(2,6,23,0.32)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Bakım Planı</h1>
          <p className="text-sm text-slate-300">
            Varlıklarınıza bakım kuralları tanımlayın. Sistem yaklaşan/geciken bakımları
            otomatik takip eder.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateRule}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-900 transition hover:bg-white"
        >
          Yeni Kural
        </button>
      </div>
    </section>
  );
}
