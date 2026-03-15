"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { PanelSurface } from "@/components/shared/panel-surface";
import { ReportsDataTable } from "@/features/reports/components/reports-data-table";
import { ReportsExportButtons } from "@/features/reports/components/reports-export-buttons";
import { ReportsFilterPanel } from "@/features/reports/components/reports-filter-panel";
import { ReportsSummaryCards } from "@/features/reports/components/reports-summary-cards";
import { useReportsRows } from "@/features/reports/hooks/use-reports-rows";
import { exportReportsPdf } from "@/features/reports/lib/export-reports-pdf";
import {
  buildAssetNameById,
  buildAssetSummary,
  calculateActiveAssetCount,
  calculateAverageCost,
  calculateTotalCost,
  currencyFormatter,
  dateInputValue,
  inputClassName,
  toTrDate,
} from "@/features/reports/lib/reports-page-utils";
import { REPORTS_TURKISH_SMOKE_TEXT, assertNoMojibakeText } from "@/features/reports/lib/text-integrity";
import { countByUser as countAssetsByUser } from "@/lib/repos/assets-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  const [userEmail, setUserEmail] = useState("");
  const [startDate, setStartDate] = useState(dateInputValue(initialStart));
  const [endDate, setEndDate] = useState(dateInputValue(today));
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const onRowsError = useCallback((message: string) => {
    setFeedback(message);
  }, []);

  const {
    services,
    documents,
    hasValidRange,
    isLoading: isRowsLoading,
    hasMoreRows,
    isLoadingMoreRows,
    loadMoreRows,
  } = useReportsRows({
    userId,
    startDate,
    endDate,
    onError: onRowsError,
  });

  useEffect(() => {
    const load = async () => {
      setIsSessionLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasValidSession(false);
        router.replace("/login");
        setIsSessionLoading(false);
        return;
      }

      setHasValidSession(true);
      setUserEmail(user.email ?? "bilinmiyor");
      setUserId(user.id);

      const assetCountRes = await countAssetsByUser(supabase, { userId: user.id });
      if (assetCountRes.error) {
        setFeedback(assetCountRes.error.message);
      }

      setTotalAssetCount(assetCountRes.data ?? 0);
      setIsSessionLoading(false);
    };

    void load();
  }, [router, supabase]);

  const assetNameById = useMemo(() => buildAssetNameById(services, documents), [documents, services]);

  const totalCost = useMemo(() => calculateTotalCost(services), [services]);

  const averageCost = useMemo(
    () => calculateAverageCost(services.length, totalCost),
    [services.length, totalCost],
  );

  const activeAssetCount = useMemo(
    () => calculateActiveAssetCount(services, documents),
    [documents, services],
  );

  const assetSummary = useMemo(
    () => buildAssetSummary(services, documents, assetNameById),
    [assetNameById, documents, services],
  );

  const onExportPdf = async () => {
    if (!hasValidRange) {
      setFeedback("Başlangıç tarihi bitiş tarihinden büyük olamaz.");
      return;
    }

    setIsExporting(true);
    setFeedback("");

    try {
      await exportReportsPdf({
        startDate,
        endDate,
        userEmail,
        totalAssetCount,
        activeAssetCount,
        servicesInRange: services,
        documentsInRange: documents,
        assetSummary,
        assetNameById,
        totalCost,
        averageCost,
        toTrDate,
        formatCurrency: (value) => currencyFormatter.format(value),
      });
      setFeedback("PDF raporu başarıyla indirildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF oluşturulurken hata oluştu.";
      setFeedback(message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasValidSession) {
    return null;
  }

  const isLoading = isSessionLoading || isRowsLoading;

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
          serviceCount={String(services.length)}
          documentCount={String(documents.length)}
          totalCost={currencyFormatter.format(totalCost)}
          averageCost={currencyFormatter.format(averageCost)}
        />

        <ReportsDataTable
          isLoading={isLoading}
          assetSummary={assetSummary}
          servicesInRange={services}
          documentsInRange={documents}
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
              {isLoadingMoreRows ? "Yükleniyor..." : "Daha Fazla Kayıt"}
            </button>
          </div>
        ) : null}
      </PanelSurface>
    </AppShell>
  );
}
