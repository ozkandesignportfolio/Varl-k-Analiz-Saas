import type { ReportsAssetSummaryRow } from "@/features/reports/components/reports-data-table";
import { ensurePdfUnicodeFont } from "@/features/reports/lib/pdf-font";
import type { DocumentRow, ServiceRow } from "@/features/reports/lib/reports-page-utils";
import { REPORTS_TURKISH_SMOKE_TEXT, assertNoMojibakeText } from "@/features/reports/lib/text-integrity";

type ExportReportsPdfArgs = {
  startDate: string;
  endDate: string;
  userEmail: string;
  totalAssetCount: number;
  activeAssetCount: number;
  servicesInRange: ServiceRow[];
  documentsInRange: DocumentRow[];
  assetSummary: ReportsAssetSummaryRow[];
  assetNameById: Map<string, string>;
  totalCost: number;
  averageCost: number;
  toTrDate: (value: string | null | undefined) => string;
  formatCurrency: (value: number) => string;
};

const REPORT_PDF_TEXT = {
  title: "AssetCare PDF Raporu",
  dateRangeLabel: REPORTS_TURKISH_SMOKE_TEXT,
  userLabel: "Kullanıcı",
  generatedAtLabel: "Üretim tarihi",
  summarySection: "Özet",
  totalAssetLabel: "Toplam varlık",
  activeAssetLabel: "Aktif varlık (aralıkta)",
  serviceCountLabel: "Servis adedi",
  documentCountLabel: "Belge adedi",
  totalCostLabel: "Toplam maliyet",
  averageCostLabel: "Ortalama servis maliyeti",
  assetSummarySection: "Varlık bazlı özet",
  serviceSection: "Servis detayları",
  documentSection: "Belge detayları",
  assetHeader: "Varlık",
  serviceHeader: "Servis",
  documentHeader: "Belge",
  costHeader: "Maliyet",
  dateHeader: "Tarih",
  typeHeader: "Tür",
  uploadHeader: "Yükleme",
  fileHeader: "Dosya",
  totalRowLabel: "TOPLAM",
  noRecordsLabel: "Kayıt bulunmuyor",
  unknownAssetLabel: "Bilinmeyen Varlık",
  unknownValueLabel: "Bilinmeyen",
} as const;

const truncate = (value: string, length: number) => {
  if (length <= 0 || value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 3))}...`;
};

const asSafeText = (value: unknown, fallback = "-") => {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length > 0 ? text : fallback;
};

const assertPdfTextIntegrity = () => {
  for (const [key, value] of Object.entries(REPORT_PDF_TEXT)) {
    assertNoMojibakeText(value, `PDF metni (${key})`);
  }
};

export async function exportReportsPdf({
  startDate,
  endDate,
  userEmail,
  totalAssetCount,
  activeAssetCount,
  servicesInRange,
  documentsInRange,
  assetSummary,
  assetNameById,
  totalCost,
  averageCost,
  toTrDate,
  formatCurrency,
}: ExportReportsPdfArgs) {
  assertPdfTextIntegrity();

  const pdfRangeLine = `${REPORT_PDF_TEXT.dateRangeLabel}: ${toTrDate(startDate)} - ${toTrDate(endDate)}`;
  assertNoMojibakeText(pdfRangeLine, "PDF tarih satırı");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  await ensurePdfUnicodeFont(doc);

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
      .map((row) => Array.from({ length: columnCount }, (_, index) => asSafeText(row?.[index], "-")))
      .filter((row) => row.some((cell) => cell !== "-"));

    if (normalizedRows.length === 0) {
      normalizedRows.push(Array.from({ length: columnCount }, (_, index) => (index === 0 ? REPORT_PDF_TEXT.noRecordsLabel : "-")));
    }

    drawSectionTitle(title);
    ensureSpace(22);

    let x = left;
    doc.setFillColor(20, 35, 58);
    doc.setTextColor(241, 245, 249);
    doc.setFont("NotoSansUnicode", "bold");
    doc.setFontSize(9);

    for (let index = 0; index < columnCount; index += 1) {
      const width = columnWidths[index];
      doc.rect(x, y - 11, width, 18, "F");
      doc.text(truncate(headers[index], 22), x + 4, y + 1);
      x += width;
    }
    y += 20;

    doc.setFont("NotoSansUnicode", "normal");
    doc.setTextColor(15, 23, 42);

    for (const row of normalizedRows) {
      ensureSpace(20);
      let rowX = left;

      for (let index = 0; index < columnCount; index += 1) {
        const width = columnWidths[index];
        doc.rect(rowX, y - 11, width, 18);
        doc.text(truncate(row[index], 28), rowX + 4, y + 1);
        rowX += width;
      }

      y += 20;
    }

    y += 6;
  };

  doc.setTextColor(15, 23, 42);
  doc.setFont("NotoSansUnicode", "bold");
  doc.setFontSize(18);
  doc.text(REPORT_PDF_TEXT.title, left, y);
  y += 20;

  doc.setFont("NotoSansUnicode", "normal");
  doc.setFontSize(10);
  doc.text(pdfRangeLine, left, y);
  y += 14;
  doc.text(`${REPORT_PDF_TEXT.userLabel}: ${asSafeText(userEmail, "bilinmiyor")}`, left, y);
  y += 14;
  doc.text(`${REPORT_PDF_TEXT.generatedAtLabel}: ${generatedAt}`, left, y);
  y += 18;

  doc.setDrawColor(148, 163, 184);
  doc.line(left, y, left + contentWidth, y);
  y += 16;

  drawSectionTitle(REPORT_PDF_TEXT.summarySection);
  drawKeyValue(REPORT_PDF_TEXT.totalAssetLabel, String(totalAssetCount));
  drawKeyValue(REPORT_PDF_TEXT.activeAssetLabel, String(activeAssetCount));
  drawKeyValue(REPORT_PDF_TEXT.serviceCountLabel, String(servicesInRange.length));
  drawKeyValue(REPORT_PDF_TEXT.documentCountLabel, String(documentsInRange.length));
  drawKeyValue(REPORT_PDF_TEXT.totalCostLabel, formatCurrency(totalCost));
  drawKeyValue(REPORT_PDF_TEXT.averageCostLabel, formatCurrency(averageCost));
  y += 6;

  drawTable(
    REPORT_PDF_TEXT.assetSummarySection,
    [
      REPORT_PDF_TEXT.assetHeader,
      REPORT_PDF_TEXT.serviceHeader,
      REPORT_PDF_TEXT.documentHeader,
      REPORT_PDF_TEXT.costHeader,
    ],
    assetSummary.map((row) => [
      row.assetName,
      String(row.serviceCount),
      String(row.documentCount),
      formatCurrency(row.totalCost),
    ]),
    [245, 80, 80, 110],
  );

  drawTable(
    REPORT_PDF_TEXT.serviceSection,
    [
      REPORT_PDF_TEXT.dateHeader,
      REPORT_PDF_TEXT.assetHeader,
      REPORT_PDF_TEXT.typeHeader,
      REPORT_PDF_TEXT.costHeader,
    ],
    [
      ...servicesInRange.map((service) => [
        toTrDate(service.service_date),
        assetNameById.get(asSafeText(service.asset_id, "")) ?? asSafeText(service.asset_name, REPORT_PDF_TEXT.unknownValueLabel),
        asSafeText(service.service_type, "-"),
        formatCurrency(Number.isFinite(Number(service.cost)) ? Number(service.cost) : 0),
      ]),
      [REPORT_PDF_TEXT.totalRowLabel, "-", "-", formatCurrency(totalCost)],
    ],
    [95, 150, 170, 100],
  );

  drawTable(
    REPORT_PDF_TEXT.documentSection,
    [REPORT_PDF_TEXT.uploadHeader, REPORT_PDF_TEXT.assetHeader, REPORT_PDF_TEXT.fileHeader],
    documentsInRange.map((docRow) => [
      toTrDate(docRow.uploaded_at),
      assetNameById.get(asSafeText(docRow.asset_id, "")) ?? asSafeText(docRow.asset_name, REPORT_PDF_TEXT.unknownAssetLabel),
      asSafeText(docRow.file_name, "-"),
    ]),
    [95, 160, 260],
  );

  doc.save(`assetcare-rapor-${startDate}-${endDate}.pdf`);
}
