export type ReportsServiceRow = {
  id: string;
  asset_id: string;
  service_date: string;
  service_type: string;
  cost: number;
};

export type ReportsDocumentRow = {
  id: string;
  asset_id: string;
  file_name: string;
  uploaded_at: string;
};

export type ReportsAssetSummaryRow = {
  assetName: string;
  serviceCount: number;
  documentCount: number;
  totalCost: number;
};

type ReportsDataTableProps = {
  isLoading: boolean;
  assetSummary: ReportsAssetSummaryRow[];
  servicesInRange: ReportsServiceRow[];
  documentsInRange: ReportsDocumentRow[];
  assetNameById: Map<string, string>;
  totalCost: number;
  toTrDate: (value: string) => string;
  formatCurrency: (value: number) => string;
};

export function ReportsDataTable({
  isLoading,
  assetSummary,
  servicesInRange,
  documentsInRange,
  assetNameById,
  totalCost,
  toTrDate,
  formatCurrency,
}: ReportsDataTableProps) {
  return (
    <>
      <section className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Varlık Bazlı Özet Tablosu</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : assetSummary.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Seçili aralıkta kayıt bulunmuyor.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                  <th className="px-3 py-2">Varlık</th>
                  <th className="px-3 py-2">Servis</th>
                  <th className="px-3 py-2">Belge</th>
                  <th className="px-3 py-2">Toplam Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {assetSummary.map((row) => (
                  <tr key={row.assetName} className="border-b border-white/10 text-slate-100">
                    <td className="px-3 py-3">{row.assetName || "-"}</td>
                    <td className="px-3 py-3">{row.serviceCount}</td>
                    <td className="px-3 py-3">{row.documentCount}</td>
                    <td className="px-3 py-3">{formatCurrency(row.totalCost)}</td>
                  </tr>
                ))}
                <tr className="bg-white/5 text-white">
                  <td className="px-3 py-3 font-semibold">TOPLAM</td>
                  <td className="px-3 py-3 font-semibold">{servicesInRange.length}</td>
                  <td className="px-3 py-3 font-semibold">{documentsInRange.length}</td>
                  <td className="px-3 py-3 font-semibold">{formatCurrency(totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Servis Detay Tablosu</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : servicesInRange.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Seçili aralıkta servis kaydı bulunmuyor.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">Varlık</th>
                    <th className="px-3 py-2">Tür</th>
                    <th className="px-3 py-2">Maliyet</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesInRange.map((service) => (
                    <tr key={service.id} className="border-b border-white/10 text-slate-100">
                      <td className="px-3 py-3">{toTrDate(service.service_date)}</td>
                      <td className="px-3 py-3">{assetNameById.get(service.asset_id) ?? "-"}</td>
                      <td className="px-3 py-3">{service.service_type || "-"}</td>
                      <td className="px-3 py-3">{formatCurrency(Number(service.cost ?? 0))}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/5 text-white">
                    <td className="px-3 py-3 font-semibold">TOPLAM</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3 font-semibold">{formatCurrency(totalCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Belge Detay Tablosu</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : documentsInRange.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Seçili aralıkta belge kaydı bulunmuyor.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                    <th className="px-3 py-2">Yükleme</th>
                    <th className="px-3 py-2">Varlık</th>
                    <th className="px-3 py-2">Dosya</th>
                  </tr>
                </thead>
                <tbody>
                  {documentsInRange.map((docRow) => (
                    <tr key={docRow.id} className="border-b border-white/10 text-slate-100">
                      <td className="px-3 py-3">{toTrDate(docRow.uploaded_at)}</td>
                      <td className="px-3 py-3">{assetNameById.get(docRow.asset_id) ?? "-"}</td>
                      <td className="px-3 py-3">{docRow.file_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </>
  );
}

