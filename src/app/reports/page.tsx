"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { listIdName } from "@/lib/repos/assets-repo";
import { createClient } from "@/lib/supabase/client";

type AssetRow = {
  id: string;
  name: string;
};

type ServiceRow = {
  id: string;
  asset_id: string;
  service_date: string;
  service_type: string;
  cost: number;
};

type DocumentRow = {
  id: string;
  asset_id: string;
  file_name: string;
  uploaded_at: string;
};

type AssetSummaryRow = {
  assetName: string;
  serviceCount: number;
  documentCount: number;
  totalCost: number;
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toStartOfDay = (value: string) => new Date(`${value}T00:00:00`);
const toEndOfDay = (value: string) => new Date(`${value}T23:59:59.999`);

const toTrDate = (value: string) => new Date(value).toLocaleDateString("tr-TR");

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const initialStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [startDate, setStartDate] = useState(dateInputValue(initialStart));
  const [endDate, setEndDate] = useState(dateInputValue(today));
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFeedback(userError?.message ?? "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setUserEmail(user.email ?? "bilinmiyor");

      const [assetsRes, servicesRes, docsRes] = await Promise.all([
        listIdName(supabase, { userId: user.id }),
        supabase
          .from("service_logs")
          .select("id,asset_id,service_date,service_type,cost")
          .eq("user_id", user.id)
          .order("service_date", { ascending: false }),
        supabase
          .from("documents")
          .select("id,asset_id,file_name,uploaded_at")
          .eq("user_id", user.id)
          .order("uploaded_at", { ascending: false }),
      ]);

      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (servicesRes.error) setFeedback(servicesRes.error.message);
      if (docsRes.error) setFeedback(docsRes.error.message);

      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setServices((servicesRes.data ?? []) as ServiceRow[]);
      setDocuments((docsRes.data ?? []) as DocumentRow[]);
      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const hasValidRange = useMemo(() => startDate <= endDate, [startDate, endDate]);

  const rangeStart = useMemo(() => toStartOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => toEndOfDay(endDate), [endDate]);

  const assetNameById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets],
  );

  const servicesInRange = useMemo(
    () =>
      services.filter((service) => {
        const date = new Date(service.service_date);
        return date >= rangeStart && date <= rangeEnd;
      }),
    [services, rangeStart, rangeEnd],
  );

  const documentsInRange = useMemo(
    () =>
      documents.filter((doc) => {
        const date = new Date(doc.uploaded_at);
        return date >= rangeStart && date <= rangeEnd;
      }),
    [documents, rangeStart, rangeEnd],
  );

  const totalCost = useMemo(
    () => servicesInRange.reduce((sum, service) => sum + Number(service.cost ?? 0), 0),
    [servicesInRange],
  );

  const averageCost = useMemo(
    () => (servicesInRange.length > 0 ? totalCost / servicesInRange.length : 0),
    [servicesInRange.length, totalCost],
  );

  const activeAssetCount = useMemo(() => {
    const ids = new Set<string>();
    for (const service of servicesInRange) ids.add(service.asset_id);
    for (const document of documentsInRange) ids.add(document.asset_id);
    return ids.size;
  }, [servicesInRange, documentsInRange]);

  const assetSummary = useMemo<AssetSummaryRow[]>(() => {
    const serviceMap = new Map<string, { serviceCount: number; totalCost: number }>();
    const documentMap = new Map<string, number>();

    for (const service of servicesInRange) {
      const previous = serviceMap.get(service.asset_id) ?? { serviceCount: 0, totalCost: 0 };
      serviceMap.set(service.asset_id, {
        serviceCount: previous.serviceCount + 1,
        totalCost: previous.totalCost + Number(service.cost ?? 0),
      });
    }

    for (const document of documentsInRange) {
      documentMap.set(document.asset_id, (documentMap.get(document.asset_id) ?? 0) + 1);
    }

    const assetIds = new Set<string>([
      ...servicesInRange.map((item) => item.asset_id),
      ...documentsInRange.map((item) => item.asset_id),
    ]);

    return [...assetIds]
      .map((assetId) => {
        const serviceInfo = serviceMap.get(assetId) ?? { serviceCount: 0, totalCost: 0 };
        const documentCount = documentMap.get(assetId) ?? 0;
        return {
          assetName: assetNameById.get(assetId) ?? "Bilinmeyen Varlık",
          serviceCount: serviceInfo.serviceCount,
          documentCount,
          totalCost: serviceInfo.totalCost,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost || b.serviceCount - a.serviceCount);
  }, [assetNameById, documentsInRange, servicesInRange]);

  const onExportPdf = async () => {
    if (!hasValidRange) {
      setFeedback("Başlangıç tarihi bitiş tarihinden büyük olamaz.");
      return;
    }

    setIsExporting(true);
    setFeedback("");

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const left = 40;
      const right = 40;
      const top = 42;
      const bottom = 36;
      const contentWidth = pageWidth - left - right;
      const generatedAt = new Date().toLocaleString("tr-TR");

      let y = top;

      const ensureSpace = (height: number) => {
        if (y + height <= pageHeight - bottom) return;
        doc.addPage();
        y = top;
      };

      const drawSectionTitle = (title: string) => {
        ensureSpace(24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, left, y);
        y += 16;
      };

      const drawKeyValue = (label: string, value: string) => {
        ensureSpace(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${label}:`, left, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, left + 130, y);
        y += 14;
      };

      const drawTable = (title: string, headers: string[], rows: string[][], columnWidths: number[]) => {
        drawSectionTitle(title);
        ensureSpace(22);

        let x = left;
        doc.setFillColor(20, 35, 58);
        doc.setTextColor(241, 245, 249);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        for (let i = 0; i < headers.length; i += 1) {
          const width = columnWidths[i];
          doc.rect(x, y - 11, width, 18, "F");
          doc.text(truncate(headers[i], 22), x + 4, y + 1);
          x += width;
        }
        y += 20;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);

        for (const row of rows) {
          ensureSpace(20);
          let rowX = left;
          for (let i = 0; i < row.length; i += 1) {
            const width = columnWidths[i];
            doc.rect(rowX, y - 11, width, 18);
            doc.text(truncate(row[i], 28), rowX + 4, y + 1);
            rowX += width;
          }
          y += 20;
        }

        y += 6;
      };

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("AssetCare PDF Raporu", left, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Rapor aralığı: ${toTrDate(startDate)} - ${toTrDate(endDate)}`, left, y);
      y += 14;
      doc.text(`Kullanıcı: ${userEmail}`, left, y);
      y += 14;
      doc.text(`Üretim tarihi: ${generatedAt}`, left, y);
      y += 18;

      doc.setDrawColor(148, 163, 184);
      doc.line(left, y, left + contentWidth, y);
      y += 16;

      drawSectionTitle("Özet");
      drawKeyValue("Toplam varlık", String(assets.length));
      drawKeyValue("Aktif varlık (aralıkta)", String(activeAssetCount));
      drawKeyValue("Servis adedi", String(servicesInRange.length));
      drawKeyValue("Belge adedi", String(documentsInRange.length));
      drawKeyValue("Toplam maliyet", currencyFormatter.format(totalCost));
      drawKeyValue("Ortalama servis maliyeti", currencyFormatter.format(averageCost));
      y += 6;

      drawTable(
        "Varlık bazlı özet",
        ["Varlık", "Servis", "Belge", "Maliyet"],
        assetSummary.map((row) => [
          row.assetName,
          String(row.serviceCount),
          String(row.documentCount),
          currencyFormatter.format(row.totalCost),
        ]),
        [245, 80, 80, 110],
      );

      drawTable(
        "Servis detayları",
        ["Tarih", "Varlık", "Tür", "Maliyet"],
        [
          ...servicesInRange.map((service) => [
            toTrDate(service.service_date),
            assetNameById.get(service.asset_id) ?? "Bilinmeyen",
            service.service_type,
            currencyFormatter.format(Number(service.cost ?? 0)),
          ]),
          ["TOPLAM", "-", "-", currencyFormatter.format(totalCost)],
        ],
        [95, 150, 170, 100],
      );

      drawTable(
        "Belge detayları",
        ["Yükleme", "Varlık", "Dosya"],
        documentsInRange.map((docRow) => [
          toTrDate(docRow.uploaded_at),
          assetNameById.get(docRow.asset_id) ?? "Bilinmeyen",
          docRow.file_name,
        ]),
        [95, 160, 260],
      );

      doc.save(`assetcare-rapor-${startDate}-${endDate}.pdf`);
      setFeedback("PDF raporu başarıyla indirildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF oluşturulurken hata oluştu.";
      setFeedback(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      badge="Raporlar"
      title="PDF Raporlama"
      subtitle="Seçili tarih aralığında özet, tablo ve toplamlar ile indirilebilir PDF raporu üretin."
      actions={
        <button
          type="button"
          onClick={() => void onExportPdf()}
          disabled={isExporting || !hasValidRange}
          className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isExporting ? "PDF hazırlanıyor..." : "PDF indir"}
        </button>
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      {!hasValidRange ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          Başlangıç tarihi bitiş tarihinden büyük olamaz.
        </p>
      ) : null}

      <section className="premium-card p-5">
        <h2 className="text-lg font-semibold text-white">Rapor İçerik Şeması</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SchemaItem index="01" title="Rapor Başlığı" description="Tarih aralığı ve kullanıcı bilgisi." />
          <SchemaItem index="02" title="Özet Metrikler" description="Varlık, servis, belge ve maliyet toplamları." />
          <SchemaItem index="03" title="Detay Tablolar" description="Servis ve belge kayıtları." />
          <SchemaItem index="04" title="Varlık Özeti" description="Varlık bazlı adet ve maliyet dağılımı." />
        </div>
      </section>

      <section className="premium-card p-5">
        <h2 className="text-lg font-semibold text-white">Tarih Aralığı</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Başlangıç</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Bitiş</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Toplam Varlık" value={String(assets.length)} />
        <SummaryCard label="Aktif Varlık" value={String(activeAssetCount)} />
        <SummaryCard label="Servis Adedi" value={String(servicesInRange.length)} />
        <SummaryCard label="Belge Adedi" value={String(documentsInRange.length)} />
        <SummaryCard label="Toplam Maliyet" value={currencyFormatter.format(totalCost)} />
        <SummaryCard label="Ortalama Servis" value={currencyFormatter.format(averageCost)} />
      </section>

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
                    <td className="px-3 py-3">{row.assetName}</td>
                    <td className="px-3 py-3">{row.serviceCount}</td>
                    <td className="px-3 py-3">{row.documentCount}</td>
                    <td className="px-3 py-3">{currencyFormatter.format(row.totalCost)}</td>
                  </tr>
                ))}
                <tr className="bg-white/5 text-white">
                  <td className="px-3 py-3 font-semibold">TOPLAM</td>
                  <td className="px-3 py-3 font-semibold">{servicesInRange.length}</td>
                  <td className="px-3 py-3 font-semibold">{documentsInRange.length}</td>
                  <td className="px-3 py-3 font-semibold">{currencyFormatter.format(totalCost)}</td>
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
                      <td className="px-3 py-3">{service.service_type}</td>
                      <td className="px-3 py-3">{currencyFormatter.format(Number(service.cost ?? 0))}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/5 text-white">
                    <td className="px-3 py-3 font-semibold">TOPLAM</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3">-</td>
                    <td className="px-3 py-3 font-semibold">{currencyFormatter.format(totalCost)}</td>
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
                      <td className="px-3 py-3">{docRow.file_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
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
