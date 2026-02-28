"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { PanelSurface } from "@/components/shared/panel-surface";
import {
  ReportsDataTable,
  type ReportsAssetSummaryRow,
  type ReportsDocumentRow,
  type ReportsServiceRow,
} from "@/features/reports/components/reports-data-table";
import { ReportsExportButtons } from "@/features/reports/components/reports-export-buttons";
import { ReportsFilterPanel } from "@/features/reports/components/reports-filter-panel";
import { ReportsSummaryCards } from "@/features/reports/components/reports-summary-cards";
import { ensurePdfUnicodeFont } from "@/features/reports/lib/pdf-font";
import { REPORTS_TURKISH_SMOKE_TEXT, assertNoMojibakeText } from "@/features/reports/lib/text-integrity";
import { countByUser as countAssetsByUser } from "@/lib/repos/assets-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type ServiceRow = ReportsServiceRow & {
  asset_name: string | null;
};

type DocumentRow = ReportsDocumentRow & {
  asset_name: string | null;
};

type AssetSummaryRow = ReportsAssetSummaryRow;
type ReportsCursor = {
  services: { createdAt: string; id: string } | null;
  documents: { uploadedAt: string; id: string } | null;
};
type ReportsPageResponse = {
  services: ServiceRow[];
  documents: DocumentRow[];
  nextCursor: ReportsCursor;
  hasMore: boolean;
  hasMoreServices: boolean;
  hasMoreDocuments: boolean;
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

const getTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const toTrDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const time = getTime(value);
  return time === null ? "-" : new Date(time).toLocaleDateString("tr-TR");
};

const asSafeText = (value: unknown, fallback = "-") => {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length > 0 ? text : fallback;
};

const truncate = (value: string | null | undefined, length: number) => {
  const text = asSafeText(value, "-");
  if (length <= 0 || text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 3))}...`;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const REPORTS_PAGE_SIZE = 100;

const reportsSubtitle = `${REPORTS_TURKISH_SMOKE_TEXT} özet, tablo ve toplamlar ile indirilebilir PDF raporu üretin.`;
assertNoMojibakeText(REPORTS_TURKISH_SMOKE_TEXT, "Raporlar duman testi");
assertNoMojibakeText(reportsSubtitle, "Raporlar alt başlığı");

export function ReportsPageContainer() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const today = useMemo(() => new Date(), []);
  const initialStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [totalAssetCount, setTotalAssetCount] = useState(0);
  const [userId, setUserId] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reportCursor, setReportCursor] = useState<ReportsCursor>({ services: null, documents: null });
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [hasMoreServices, setHasMoreServices] = useState(false);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(false);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [startDate, setStartDate] = useState(dateInputValue(initialStart));
  const [endDate, setEndDate] = useState(dateInputValue(today));
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);

  const fetchReportRows = useCallback(
    async (
      _currentUserId: string,
      options: {
        append: boolean;
        cursor: ReportsCursor | null;
        startDateValue: string;
        endDateValue: string;
        includeServices?: boolean;
        includeDocuments?: boolean;
      },
    ) => {
      if (options.append) {
        setIsLoadingMoreRows(true);
      } else {
        setIsLoading(true);
      }

      const query = new URLSearchParams();
      query.set("from", options.startDateValue);
      query.set("to", options.endDateValue);
      query.set("pageSize", String(REPORTS_PAGE_SIZE));
      query.set("includeServices", (options.includeServices ?? true) ? "1" : "0");
      query.set("includeDocuments", (options.includeDocuments ?? true) ? "1" : "0");
      if (options.cursor?.services?.createdAt) query.set("servicesCursorCreatedAt", options.cursor.services.createdAt);
      if (options.cursor?.services?.id) query.set("servicesCursorId", options.cursor.services.id);
      if (options.cursor?.documents?.uploadedAt) query.set("documentsCursorUploadedAt", options.cursor.documents.uploadedAt);
      if (options.cursor?.documents?.id) query.set("documentsCursorId", options.cursor.documents.id);

      const response = await fetch(`/api/reports?${query.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | (ReportsPageResponse & { error?: never })
        | { error?: string }
        | null;

      if (!response.ok) {
        setFeedback(payload?.error ?? "Rapor satirlari yuklenemedi.");
        if (options.append) {
          setIsLoadingMoreRows(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      const pageData: ReportsPageResponse = payload && "nextCursor" in payload
        ? {
            services: payload.services ?? [],
            documents: payload.documents ?? [],
            nextCursor: payload.nextCursor ?? { services: null, documents: null },
            hasMore: payload.hasMore ?? false,
            hasMoreServices: payload.hasMoreServices ?? false,
            hasMoreDocuments: payload.hasMoreDocuments ?? false,
          }
        : {
        services: [] as ServiceRow[],
        documents: [] as DocumentRow[],
        nextCursor: { services: null, documents: null },
        hasMore: false,
        hasMoreServices: false,
        hasMoreDocuments: false,
      };
      const nextServices = pageData.services as ServiceRow[];
      const nextDocuments = pageData.documents as DocumentRow[];

      setHasMoreRows(pageData.hasMore);
      setHasMoreServices(pageData.hasMoreServices);
      setHasMoreDocuments(pageData.hasMoreDocuments);
      setReportCursor(pageData.nextCursor);

      if (options.append) {
        setServices((prev) => [...prev, ...nextServices]);
        setDocuments((prev) => [...prev, ...nextDocuments]);
        setIsLoadingMoreRows(false);
      } else {
        setServices(nextServices);
        setDocuments(nextDocuments);
        setIsLoading(false);
      }
    },
    [],
  );

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

      setUserId(user.id);

      const assetCountRes = await countAssetsByUser(supabase, { userId: user.id });

      if (assetCountRes.error) setFeedback(assetCountRes.error.message);

      setTotalAssetCount(assetCountRes.data ?? 0);
      setIsLoading(false);
    };

    void load();
  }, [router, supabase]);

  const rangeStart = useMemo(() => toStartOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => toEndOfDay(endDate), [endDate]);
  const hasValidRange = useMemo(() => {
    const start = rangeStart.getTime();
    const end = rangeEnd.getTime();
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= end;
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (!hasValidRange) {
      setServices([]);
      setDocuments([]);
      setHasMoreRows(false);
      setHasMoreServices(false);
      setHasMoreDocuments(false);
      setReportCursor({ services: null, documents: null });
      return;
    }

    void fetchReportRows(userId, {
      append: false,
      cursor: null,
      startDateValue: startDate,
      endDateValue: endDate,
    });
  }, [endDate, fetchReportRows, hasValidRange, startDate, userId]);

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>();

    const register = (assetId: string, assetName: string | null) => {
      const safeAssetId = asSafeText(assetId, "");
      const safeAssetName = asSafeText(assetName, "");
      if (!safeAssetId || !safeAssetName || map.has(safeAssetId)) return;
      map.set(safeAssetId, safeAssetName);
    };

    for (const service of services) register(service.asset_id, service.asset_name);
    for (const document of documents) register(document.asset_id, document.asset_name);

    return map;
  }, [documents, services]);

  const servicesInRange = services;
  const documentsInRange = documents;

  const totalCost = useMemo(
    () =>
      servicesInRange.reduce((sum, service) => {
        const cost = Number(service.cost);
        return sum + (Number.isFinite(cost) ? cost : 0);
      }, 0),
    [servicesInRange],
  );

  const averageCost = useMemo(
    () => (servicesInRange.length > 0 ? totalCost / servicesInRange.length : 0),
    [servicesInRange.length, totalCost],
  );

  const activeAssetCount = useMemo(() => {
    const ids = new Set<string>();
    for (const service of servicesInRange) {
      const assetId = asSafeText(service.asset_id, "");
      if (assetId) ids.add(assetId);
    }
    for (const document of documentsInRange) {
      const assetId = asSafeText(document.asset_id, "");
      if (assetId) ids.add(assetId);
    }
    return ids.size;
  }, [servicesInRange, documentsInRange]);

  const assetSummary = useMemo<AssetSummaryRow[]>(() => {
    const serviceMap = new Map<string, { serviceCount: number; totalCost: number }>();
    const documentMap = new Map<string, number>();

    for (const service of servicesInRange) {
      const assetId = asSafeText(service.asset_id, "__missing_asset__");
      const previous = serviceMap.get(assetId) ?? { serviceCount: 0, totalCost: 0 };
      const cost = Number(service.cost);
      serviceMap.set(assetId, {
        serviceCount: previous.serviceCount + 1,
        totalCost: previous.totalCost + (Number.isFinite(cost) ? cost : 0),
      });
    }

    for (const document of documentsInRange) {
      const assetId = asSafeText(document.asset_id, "__missing_asset__");
      documentMap.set(assetId, (documentMap.get(assetId) ?? 0) + 1);
    }

    const assetIds = new Set<string>([
      ...servicesInRange.map((item) => asSafeText(item.asset_id, "__missing_asset__")),
      ...documentsInRange.map((item) => asSafeText(item.asset_id, "__missing_asset__")),
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

  const loadMoreRows = useCallback(async () => {
    if (!userId || !hasValidRange || !hasMoreRows || isLoadingMoreRows) {
      return;
    }

    await fetchReportRows(userId, {
      append: true,
      cursor: {
        services: hasMoreServices ? reportCursor.services : null,
        documents: hasMoreDocuments ? reportCursor.documents : null,
      },
      startDateValue: startDate,
      endDateValue: endDate,
      includeServices: hasMoreServices,
      includeDocuments: hasMoreDocuments,
    });
  }, [
    endDate,
    fetchReportRows,
    hasMoreRows,
    hasValidRange,
    isLoadingMoreRows,
    reportCursor.documents,
    reportCursor.services,
    startDate,
    userId,
    hasMoreServices,
    hasMoreDocuments,
  ]);

  if (!hasValidSession) {
    return null;
  }

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

      await ensurePdfUnicodeFont(doc);
      assertNoMojibakeText(REPORTS_TURKISH_SMOKE_TEXT, "PDF duman testi");

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
        doc.setFont("NotoSansUnicode", "bold");
        doc.setFontSize(12);
        doc.text(title, left, y);
        y += 16;
      };

      const drawKeyValue = (label: string, value: string) => {
        ensureSpace(14);
        doc.setFont("NotoSansUnicode", "bold");
        doc.setFontSize(10);
        doc.text(`${label}:`, left, y);
        doc.setFont("NotoSansUnicode", "normal");
        doc.text(value, left + 130, y);
        y += 14;
      };

      const drawTable = (title: string, headers: string[], rows: string[][], columnWidths: number[]) => {
        const columnCount = Math.min(headers.length, columnWidths.length);
        if (columnCount === 0) return;

        const normalizedRows = rows
          .map((row) => Array.from({ length: columnCount }, (_, i) => asSafeText(row?.[i], "-")))
          .filter((row) => row.some((cell) => cell !== "-"));

        if (normalizedRows.length === 0) {
          normalizedRows.push(Array.from({ length: columnCount }, (_, i) => (i === 0 ? "Kayıt bulunmuyor" : "-")));
        }

        drawSectionTitle(title);
        ensureSpace(22);

        let x = left;
        doc.setFillColor(20, 35, 58);
        doc.setTextColor(241, 245, 249);
        doc.setFont("NotoSansUnicode", "bold");
        doc.setFontSize(9);

        for (let i = 0; i < columnCount; i += 1) {
          const width = columnWidths[i];
          doc.rect(x, y - 11, width, 18, "F");
          doc.text(truncate(headers[i], 22), x + 4, y + 1);
          x += width;
        }
        y += 20;

        doc.setFont("NotoSansUnicode", "normal");
        doc.setTextColor(15, 23, 42);

        for (const row of normalizedRows) {
          ensureSpace(20);
          let rowX = left;
          for (let i = 0; i < columnCount; i += 1) {
            const width = columnWidths[i];
            doc.rect(rowX, y - 11, width, 18);
            doc.text(truncate(row[i], 28), rowX + 4, y + 1);
            rowX += width;
          }
          y += 20;
        }

        y += 6;
      };

      const pdfRangeLine = `${REPORTS_TURKISH_SMOKE_TEXT}: ${toTrDate(startDate)} - ${toTrDate(endDate)}`;
      assertNoMojibakeText(pdfRangeLine, "PDF tarih satırı");

      doc.setTextColor(15, 23, 42);
      doc.setFont("NotoSansUnicode", "bold");
      doc.setFontSize(18);
      doc.text("AssetCare PDF Raporu", left, y);
      y += 20;

      doc.setFont("NotoSansUnicode", "normal");
      doc.setFontSize(10);
      doc.text(pdfRangeLine, left, y);
      y += 14;
      doc.text(`Kullanıcı: ${userEmail}`, left, y);
      y += 14;
      doc.text(`Üretim tarihi: ${generatedAt}`, left, y);
      y += 18;

      doc.setDrawColor(148, 163, 184);
      doc.line(left, y, left + contentWidth, y);
      y += 16;

      drawSectionTitle("Özet");
      drawKeyValue("Toplam varlık", String(totalAssetCount));
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
            assetNameById.get(asSafeText(service.asset_id, "")) ?? asSafeText(service.asset_name, "Bilinmeyen"),
            asSafeText(service.service_type, "-"),
            currencyFormatter.format(Number.isFinite(Number(service.cost)) ? Number(service.cost) : 0),
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
          assetNameById.get(asSafeText(docRow.asset_id, "")) ?? asSafeText(docRow.asset_name, "Bilinmeyen"),
          asSafeText(docRow.file_name, "-"),
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
      subtitle={reportsSubtitle}
      actions={
        <ReportsExportButtons
          onExportPdf={() => {
            void onExportPdf();
          }}
          isExporting={isExporting}
          hasValidRange={hasValidRange}
          canExportPdfReports
        />
      }
    >
      <PanelSurface>
        <PageHeader title="Raporlar" subtitle="Filtreleme, özet metrikler ve dışa aktarma." />

        {feedback ? (
          <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{feedback}</p>
        ) : null}

        {!hasValidRange ? (
          <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            Başlangıç tarihi bitiş tarihinden büyük olamaz.
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
          totalAssetCount={String(totalAssetCount)}
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

        {hasValidRange && hasMoreRows ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                void loadMoreRows();
              }}
              disabled={isLoadingMoreRows}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMoreRows ? "Yukleniyor..." : "Daha Fazla Kayit"}
            </button>
          </div>
        ) : null}
      </PanelSurface>
    </AppShell>
  );
}
