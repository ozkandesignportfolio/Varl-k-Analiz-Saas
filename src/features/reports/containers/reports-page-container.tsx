"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ReportsDataTable,
  type ReportsAssetSummaryRow,
  type ReportsDocumentRow,
  type ReportsServiceRow,
} from "@/features/reports/components/reports-data-table";
import { ReportsExportButtons } from "@/features/reports/components/reports-export-buttons";
import { ReportsFilterPanel } from "@/features/reports/components/reports-filter-panel";
import { ReportsSummaryCards } from "@/features/reports/components/reports-summary-cards";
import { listIdName } from "@/lib/repos/assets-repo";
import { listForReports as listDocumentsForReports } from "@/lib/repos/documents-repo";
import { listForReports as listServiceLogsForReports } from "@/lib/repos/service-logs-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetRow = {
  id: string;
  name: string;
};

type ServiceRow = ReportsServiceRow;

type DocumentRow = ReportsDocumentRow;

type AssetSummaryRow = ReportsAssetSummaryRow;

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
  value.length > length ? `${value.slice(0, length - 1)}â€¦` : value;

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export function ReportsPageContainer() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const today = useMemo(() => new Date(), []);
  const initialStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [startDate, setStartDate] = useState(dateInputValue(initialStart));
  const [endDate, setEndDate] = useState(dateInputValue(today));
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasValidSession(false);
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      setHasValidSession(true);
      setUserEmail(user.email ?? "bilinmiyor");

      const [assetsRes, servicesRes, docsRes] = await Promise.all([
        listIdName(supabase, { userId: user.id }),
        listServiceLogsForReports(supabase, { userId: user.id }),
        listDocumentsForReports(supabase, { userId: user.id }),
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
  }, [router, supabase]);

  const hasValidRange = useMemo(() => startDate <= endDate, [startDate, endDate]);

  const rangeStart = useMemo(() => toStartOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => toEndOfDay(endDate), [endDate]);

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

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
          assetName: assetNameById.get(assetId) ?? "Bilinmeyen VarlÄ±k",
          serviceCount: serviceInfo.serviceCount,
          documentCount,
          totalCost: serviceInfo.totalCost,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost || b.serviceCount - a.serviceCount);
  }, [assetNameById, documentsInRange, servicesInRange]);

  if (!hasValidSession) {
    return null;
  }

  const onExportPdf = async () => {
    if (!hasValidRange) {
      setFeedback("BaÅŸlangÄ±Ã§ tarihi bitiÅŸ tarihinden bÃ¼yÃ¼k olamaz.");
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
      doc.text(`Rapor aralÄ±ÄŸÄ±: ${toTrDate(startDate)} - ${toTrDate(endDate)}`, left, y);
      y += 14;
      doc.text(`KullanÄ±cÄ±: ${userEmail}`, left, y);
      y += 14;
      doc.text(`Ãœretim tarihi: ${generatedAt}`, left, y);
      y += 18;

      doc.setDrawColor(148, 163, 184);
      doc.line(left, y, left + contentWidth, y);
      y += 16;

      drawSectionTitle("Ã–zet");
      drawKeyValue("Toplam varlÄ±k", String(assets.length));
      drawKeyValue("Aktif varlÄ±k (aralÄ±kta)", String(activeAssetCount));
      drawKeyValue("Servis adedi", String(servicesInRange.length));
      drawKeyValue("Belge adedi", String(documentsInRange.length));
      drawKeyValue("Toplam maliyet", currencyFormatter.format(totalCost));
      drawKeyValue("Ortalama servis maliyeti", currencyFormatter.format(averageCost));
      y += 6;

      drawTable(
        "VarlÄ±k bazlÄ± Ã¶zet",
        ["VarlÄ±k", "Servis", "Belge", "Maliyet"],
        assetSummary.map((row) => [
          row.assetName,
          String(row.serviceCount),
          String(row.documentCount),
          currencyFormatter.format(row.totalCost),
        ]),
        [245, 80, 80, 110],
      );

      drawTable(
        "Servis detaylarÄ±",
        ["Tarih", "VarlÄ±k", "TÃ¼r", "Maliyet"],
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
        "Belge detaylarÄ±",
        ["YÃ¼kleme", "VarlÄ±k", "Dosya"],
        documentsInRange.map((docRow) => [
          toTrDate(docRow.uploaded_at),
          assetNameById.get(docRow.asset_id) ?? "Bilinmeyen",
          docRow.file_name,
        ]),
        [95, 160, 260],
      );

      doc.save(`assetcare-rapor-${startDate}-${endDate}.pdf`);
      setFeedback("PDF raporu baÅŸarÄ±yla indirildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF oluÅŸturulurken hata oluÅŸtu.";
      setFeedback(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      badge="Raporlar"
      title="PDF Raporlama"
      subtitle="SeÃ§ili tarih aralÄ±ÄŸÄ±nda Ã¶zet, tablo ve toplamlar ile indirilebilir PDF raporu Ã¼retin."
      actions={
        <ReportsExportButtons
          onExportPdf={() => {
            void onExportPdf();
          }}
          isExporting={isExporting}
          hasValidRange={hasValidRange}
        />
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      {!hasValidRange ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          BaÅŸlangÄ±Ã§ tarihi bitiÅŸ tarihinden bÃ¼yÃ¼k olamaz.
        </p>
      ) : null}

      <ReportsFilterPanel
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        inputClassName={inputClassName}
      />

      <ReportsSummaryCards
        totalAssetCount={String(assets.length)}
        activeAssetCount={String(activeAssetCount)}
        serviceCount={String(servicesInRange.length)}
        documentCount={String(documentsInRange.length)}
        totalCost={currencyFormatter.format(totalCost)}
        averageCost={currencyFormatter.format(averageCost)}
      />

      <ReportsDataTable
        isLoading={isLoading}
        assetSummary={assetSummary}
        servicesInRange={servicesInRange}
        documentsInRange={documentsInRange}
        assetNameById={assetNameById}
        totalCost={totalCost}
        toTrDate={toTrDate}
        formatCurrency={(value) => currencyFormatter.format(value)}
      />
    </AppShell>
  );
}
