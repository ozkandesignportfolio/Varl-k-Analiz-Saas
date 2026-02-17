type ReportsFilterPanelProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  inputClassName: string;
};

export function ReportsFilterPanel({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  inputClassName,
}: ReportsFilterPanelProps) {
  return (
    <>
      <section className="premium-card p-5">
        <h2 className="text-lg font-semibold text-white">Rapor Ä°Ã§erik ÅemasÄ±</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SchemaItem index="01" title="Rapor BaÅŸlÄ±ÄŸÄ±" description="Tarih aralÄ±ÄŸÄ± ve kullanÄ±cÄ± bilgisi." />
          <SchemaItem index="02" title="Ã–zet Metrikler" description="VarlÄ±k, servis, belge ve maliyet toplamlarÄ±." />
          <SchemaItem index="03" title="Detay Tablolar" description="Servis ve belge kayÄ±tlarÄ±." />
          <SchemaItem index="04" title="VarlÄ±k Ã–zeti" description="VarlÄ±k bazlÄ± adet ve maliyet daÄŸÄ±lÄ±mÄ±." />
        </div>
      </section>

      <section className="premium-card p-5">
        <h2 className="text-lg font-semibold text-white">Tarih AralÄ±ÄŸÄ±</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">BaÅŸlangÄ±Ã§</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">BitiÅŸ</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
      </section>
    </>
  );
}

function SchemaItem({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{index}</p>
      <p className="mt-1 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-300">{description}</p>
    </article>
  );
}
