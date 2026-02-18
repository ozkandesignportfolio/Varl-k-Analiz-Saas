type ReportsExportButtonsProps = {
  onExportPdf: () => void;
  isExporting: boolean;
  hasValidRange: boolean;
  canExportReports: boolean;
};

export function ReportsExportButtons({
  onExportPdf,
  isExporting,
  hasValidRange,
  canExportReports,
}: ReportsExportButtonsProps) {
  return (
    <button
      type="button"
      onClick={onExportPdf}
      disabled={isExporting || !hasValidRange || !canExportReports}
      className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isExporting ? "PDF hazÄ±rlanÄ±yor..." : "PDF indir"}
    </button>
  );
}
