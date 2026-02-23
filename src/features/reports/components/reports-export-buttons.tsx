type ReportsExportButtonsProps = {
  onExportPdf: () => void;
  isExporting: boolean;
  hasValidRange: boolean;
  canExportPdfReports: boolean;
};

export function ReportsExportButtons({
  onExportPdf,
  isExporting,
  hasValidRange,
  canExportPdfReports,
}: ReportsExportButtonsProps) {
  return (
    <button
      type="button"
      onClick={onExportPdf}
      disabled={isExporting || !hasValidRange || !canExportPdfReports}
      title={!canExportPdfReports ? "PDF rapor export bu plan için kapalı." : undefined}
      className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isExporting ? "PDF hazırlanıyor..." : "PDF indir"}
    </button>
  );
}
