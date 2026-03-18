type ReportsExportButtonsProps = {
  onExportPdf: () => void;
  isExporting: boolean;
  hasValidRange: boolean;
  canExportPdfReports: boolean;
  isPlanLoading?: boolean;
  premiumMessage?: string;
  showPremiumMessage?: boolean;
};

export function ReportsExportButtons({
  onExportPdf,
  isExporting,
  hasValidRange,
  canExportPdfReports,
  isPlanLoading = false,
  premiumMessage = "PDF raporları Premium planına özeldir.",
  showPremiumMessage = false,
}: ReportsExportButtonsProps) {
  const isDisabled = isExporting || !hasValidRange || !canExportPdfReports || isPlanLoading;
  const title = showPremiumMessage ? premiumMessage : isPlanLoading ? "Plan bilgisi kontrol ediliyor." : undefined;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onExportPdf}
        disabled={isDisabled}
        title={title}
        className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        data-testid="reports-export-pdf-button"
      >
        {isExporting ? "PDF hazırlanıyor..." : "PDF indir"}
      </button>

      {showPremiumMessage ? <p className="text-xs text-amber-100">{premiumMessage}</p> : null}
    </div>
  );
}
