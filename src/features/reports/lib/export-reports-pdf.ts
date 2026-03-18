import type { ReportsAssetSummaryRow } from "@/features/reports/components/reports-data-table";
import { ensurePdfUnicodeFont } from "@/features/reports/lib/pdf-font";
import type { DocumentRow, ServiceRow } from "@/features/reports/lib/reports-page-utils";
import { assertNoMojibakeText } from "@/features/reports/lib/text-integrity";
import { calculateScoreAnalysis } from "@/lib/scoring/score-analysis";

type PdfAssetRow = {
  id: string;
  name: string;
  purchase_price: number | null;
  warranty_end_date: string | null;
};

type PdfMaintenanceRuleRow = {
  id: string;
  asset_id: string;
  is_active: boolean;
  next_due_date: string | null;
  last_service_date: string | null;
};

type PdfExpenseRow = {
  id: string;
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
};

type PdfSubscriptionRow = {
  id: string;
  status: "active" | "paused" | "cancelled";
  next_billing_date: string | null;
};

type PdfInvoiceRow = {
  id: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
};

type ExportReportsPdfArgs = {
  startDate: string;
  endDate: string;
  userEmail: string;
  organizationName: string;
  totalAssetCount: number;
  activeAssetCount: number;
  servicesInRange: ServiceRow[];
  documentsInRange: DocumentRow[];
  assetSummary: ReportsAssetSummaryRow[];
  assetNameById: Map<string, string>;
  totalCost: number;
  averageCost: number;
  assets: PdfAssetRow[];
  maintenanceRules: PdfMaintenanceRuleRow[];
  expenses: PdfExpenseRow[];
  subscriptions: PdfSubscriptionRow[];
  invoices: PdfInvoiceRow[];
  toTrDate: (value: string | null | undefined) => string;
  formatCurrency: (value: number) => string;
};

const REPORT_PDF_TEXT = {
  brand: "Assetly",
  title: "Premium PDF Raporu",
  dateRangeLabel: "Tarih aralığı",
  reportDateLabel: "Rapor tarihi",
  organizationLabel: "Organizasyon",
  userLabel: "Kullanıcı",
  generatedAtLabel: "Üretim zamanı",
  reportHeaderSection: "Rapor Başlığı",
  assetOverviewSection: "Varlık Özeti",
  totalAssetLabel: "Toplam varlık sayısı",
  activeAssetLabel: "Aktif varlıklar",
  purchaseValueLabel: "Toplam satın alma değeri",
  warrantyCoveredLabel: "Garanti kapsamındaki varlıklar",
  serviceCountLabel: "Servis kaydı",
  documentCountLabel: "Belge kaydı",
  totalCostLabel: "Servis maliyetleri",
  averageCostLabel: "Ortalama servis maliyeti",
  maintenanceSection: "Bakım Bilgileri",
  upcomingMaintenanceLabel: "Yaklaşan bakım sayısı",
  overdueMaintenanceLabel: "Geciken bakım sayısı",
  recentMaintenanceSection: "Son bakım kayıtları",
  costAnalysisSection: "Maliyet Analizi",
  expenseTotalLabel: "Gider toplamları",
  maintenanceCostLabel: "Bakım maliyeti",
  documentSection: "Belgeler",
  documentedAssetLabel: "Belgeli varlık sayısı",
  missingDocumentLabel: "Eksik belge sayısı",
  scoreSection: "Skor Analizi",
  overallScoreLabel: "Genel skor",
  subScoresSection: "Alt skorlar",
  scoreCommentLabel: "Kısa yorum",
  assetSummarySection: "Varlık bazlı özet",
  serviceSection: "Son servis kayıtları",
  documentDetailSection: "Belge detayları",
  assetHeader: "Varlık adı",
  serviceHeader: "Servis",
  documentHeader: "Belge",
  costHeader: "Maliyet",
  dateHeader: "Tarih",
  typeHeader: "İşlem",
  uploadHeader: "Yükleme",
  fileHeader: "Dosya",
  scoreHeader: "Skor",
  summaryHeader: "Özet",
  totalRowLabel: "TOPLAM",
  noRecordsLabel: "Kayıt bulunmuyor",
  unknownAssetLabel: "Bilinmeyen Varlık",
  unknownValueLabel: "Bilinmeyen",
  footerLabel: "Assetly Premium PDF Raporu",
} as const;

const DEFAULT_ORGANIZATION_NAME = "Kişisel Çalışma Alanı";

const truncate = (value: string, length: number) => {
  if (length <= 0 || value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 3))}...`;
};

const asSafeText = (value: unknown, fallback = "-") => {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length > 0 ? text : fallback;
};

const asMoney = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const toTime = (value: string | null | undefined) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const sortByDateDesc = <T>(rows: T[], getDate: (row: T) => string | null | undefined) =>
  [...rows].sort((left, right) => (toTime(getDate(right)) ?? 0) - (toTime(getDate(left)) ?? 0));

const assertPdfTextIntegrity = () => {
  for (const [key, value] of Object.entries(REPORT_PDF_TEXT)) {
    assertNoMojibakeText(value, `PDF metni (${key})`);
  }
};

export async function exportReportsPdf({
  startDate,
  endDate,
  userEmail,
  organizationName,
  totalAssetCount,
  activeAssetCount,
  servicesInRange,
  documentsInRange,
  assetSummary,
  assetNameById,
  totalCost,
  averageCost,
  assets,
  maintenanceRules,
  expenses,
  subscriptions,
  invoices,
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
  const gap = 12;
  const contentWidth = pageWidth - left - right;
  const generatedAt = new Date().toLocaleString("tr-TR");
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const inThirtyDays = new Date(todayStart);
  inThirtyDays.setDate(todayStart.getDate() + 30);

  const totalPurchaseValue = assets.reduce((sum, asset) => sum + asMoney(asset.purchase_price), 0);
  const warrantyCoveredCount = assets.filter((asset) => {
    const warrantyTime = toTime(asset.warranty_end_date);
    return warrantyTime !== null && warrantyTime >= todayStart.getTime();
  }).length;
  const documentedAssetCount = new Set(
    documentsInRange
      .map((document) => asSafeText(document.asset_id, ""))
      .filter((assetId) => assetId.length > 0),
  ).size;
  const missingDocumentCount = Math.max(0, assets.length - documentedAssetCount);
  const expenseTotal = expenses.reduce((sum, expense) => sum + asMoney(expense.amount), 0);
  const maintenanceCost = totalCost + expenseTotal;
  const upcomingMaintenanceCount = maintenanceRules.filter((rule) => {
    if (!rule.is_active) return false;
    const nextDueTime = toTime(rule.next_due_date);
    return nextDueTime !== null && nextDueTime >= todayStart.getTime() && nextDueTime <= inThirtyDays.getTime();
  }).length;
  const overdueMaintenanceCount = maintenanceRules.filter((rule) => {
    if (!rule.is_active) return false;
    const nextDueTime = toTime(rule.next_due_date);
    return nextDueTime !== null && nextDueTime < todayStart.getTime();
  }).length;

  const sortedServices = sortByDateDesc(servicesInRange, (service) => service.service_date);
  const sortedDocuments = sortByDateDesc(documentsInRange, (document) => document.uploaded_at);
  const recentServiceRows = sortedServices.slice(0, 6);

  const scoreAnalysis = calculateScoreAnalysis({
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      purchasePrice: asset.purchase_price,
      warrantyEndDate: asset.warranty_end_date,
    })),
    maintenanceRules: maintenanceRules.map((rule) => ({
      id: rule.id,
      assetId: rule.asset_id,
      isActive: rule.is_active,
      nextDueDate: rule.next_due_date,
      lastServiceDate: rule.last_service_date,
    })),
    serviceLogs: servicesInRange.map((service) => ({
      assetId: service.asset_id,
      cost: asMoney(service.cost),
    })),
    documents: documentsInRange.map((document) => ({
      assetId: document.asset_id,
    })),
    expenses: expenses.map((expense) => ({
      assetId: expense.asset_id,
      amount: asMoney(expense.amount),
      category: expense.category,
      note: expense.note,
    })),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      nextBillingDate: subscription.next_billing_date,
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      dueDate: invoice.due_date,
    })),
  });

  const scoreSections = scoreAnalysis.sections.filter((section) => section.applicable);
  const scoreComment =
    scoreAnalysis.suggestions[0]?.text ??
    scoreAnalysis.emptyState?.description ??
    scoreSections[0]?.summary ??
    "Skor verisi mevcut kayıtlarla otomatik oluşturuldu.";

  let y = top;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - bottom) return;
    doc.addPage();
    y = top;
  };

  const drawDivider = () => {
    ensureSpace(16);
    doc.setDrawColor(203, 213, 225);
    doc.line(left, y, left + contentWidth, y);
    y += 16;
  };

  const drawSectionTitle = (title: string, description?: string) => {
    ensureSpace(description ? 44 : 26);
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(1);
    doc.line(left, y - 2, left + 26, y - 2);
    doc.setFont("NotoSansUnicode", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text(title, left, y);
    y += 16;

    if (description) {
      doc.setFont("NotoSansUnicode", "normal");
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(description, contentWidth);
      doc.text(lines, left, y);
      y += lines.length * 11;
    }

    y += 4;
  };

  const drawKeyValue = (label: string, value: string) => {
    ensureSpace(14);
    doc.setFont("NotoSansUnicode", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`${label}:`, left, y);
    doc.setFont("NotoSansUnicode", "normal");
    doc.text(value, left + 130, y);
    y += 14;
  };

  const drawMetricCards = (items: Array<{ label: string; value: string; note?: string }>) => {
    const columns = 2;
    const cardWidth = (contentWidth - gap) / columns;

    for (let index = 0; index < items.length; index += columns) {
      const rowItems = items.slice(index, index + columns).map((item) => {
        const valueLines = doc.splitTextToSize(item.value, cardWidth - 24);
        const noteLines = item.note ? doc.splitTextToSize(item.note, cardWidth - 24) : [];
        return {
          ...item,
          valueLines,
          noteLines,
          height: 54 + valueLines.length * 12 + noteLines.length * 10,
        };
      });

      const rowHeight = Math.max(...rowItems.map((item) => item.height), 82);
      ensureSpace(rowHeight + gap);

      rowItems.forEach((item, itemIndex) => {
        const x = left + itemIndex * (cardWidth + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, cardWidth, rowHeight, 12, 12, "FD");

        doc.setFont("NotoSansUnicode", "normal");
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text(item.label.toLocaleUpperCase("tr-TR"), x + 12, y + 16);

        doc.setFont("NotoSansUnicode", "bold");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.text(item.valueLines, x + 12, y + 36);

        if (item.noteLines.length > 0) {
          doc.setFont("NotoSansUnicode", "normal");
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(8);
          doc.text(item.noteLines, x + 12, y + 48 + item.valueLines.length * 12);
        }
      });

      y += rowHeight + gap;
    }
  };

  const drawWrappedText = (label: string, value: string) => {
    drawSectionTitle(label);
    const lines = doc.splitTextToSize(value, contentWidth);
    ensureSpace(lines.length * 12 + 8);
    doc.setFont("NotoSansUnicode", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text(lines, left, y);
    y += lines.length * 12 + 4;
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
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(241, 245, 249);
    doc.setFont("NotoSansUnicode", "bold");
    doc.setFontSize(9);

    for (let index = 0; index < columnCount; index += 1) {
      const width = columnWidths[index];
      doc.rect(x, y - 11, width, 18, "F");
      doc.text(truncate(headers[index], 28), x + 4, y + 1);
      x += width;
    }
    y += 20;

    doc.setFont("NotoSansUnicode", "normal");
    doc.setTextColor(15, 23, 42);

    normalizedRows.forEach((row, rowIndex) => {
      ensureSpace(20);
      let rowX = left;

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(left, y - 11, contentWidth, 18, "F");
      }

      for (let index = 0; index < columnCount; index += 1) {
        const width = columnWidths[index];
        doc.rect(rowX, y - 11, width, 18);
        doc.text(truncate(row[index], 42), rowX + 4, y + 1);
        rowX += width;
      }

      y += 20;
    });

    y += 6;
  };

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(left, y, contentWidth, 104, 18, 18, "F");
  doc.setTextColor(125, 211, 252);
  doc.setFont("NotoSansUnicode", "bold");
  doc.setFontSize(11);
  doc.text(REPORT_PDF_TEXT.brand, left + 18, y + 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(REPORT_PDF_TEXT.title, left + 18, y + 46);
  doc.setFont("NotoSansUnicode", "normal");
  doc.setFontSize(10);
  doc.text(pdfRangeLine, left + 18, y + 68);
  doc.text(`${REPORT_PDF_TEXT.organizationLabel}: ${asSafeText(organizationName, DEFAULT_ORGANIZATION_NAME)}`, left + 18, y + 84);
  doc.text(`${REPORT_PDF_TEXT.userLabel}: ${asSafeText(userEmail, "bilinmiyor")}`, left + 265, y + 84);
  y += 122;

  drawSectionTitle(REPORT_PDF_TEXT.reportHeaderSection, "Raporun üretim zamanı ve organizasyon kimliği");
  drawKeyValue(REPORT_PDF_TEXT.reportDateLabel, toTrDate(endDate));
  drawKeyValue(REPORT_PDF_TEXT.organizationLabel, asSafeText(organizationName, DEFAULT_ORGANIZATION_NAME));
  drawKeyValue(REPORT_PDF_TEXT.generatedAtLabel, generatedAt);
  drawDivider();

  drawSectionTitle(REPORT_PDF_TEXT.assetOverviewSection, "Portföyün temel varlık görünümü");
  drawMetricCards([
    {
      label: REPORT_PDF_TEXT.totalAssetLabel,
      value: String(totalAssetCount),
      note: `${servicesInRange.length} servis ve ${documentsInRange.length} belge kaydı rapora dahil edildi.`,
    },
    {
      label: REPORT_PDF_TEXT.purchaseValueLabel,
      value: formatCurrency(totalPurchaseValue),
      note: "Satın alma bedeli girilmiş varlıkların toplamı.",
    },
    {
      label: REPORT_PDF_TEXT.activeAssetLabel,
      value: String(activeAssetCount),
      note: "Seçili aralıkta hareket görülen varlıklar.",
    },
    {
      label: REPORT_PDF_TEXT.warrantyCoveredLabel,
      value: String(warrantyCoveredCount),
      note: "Garanti süresi halen devam eden varlıklar.",
    },
  ]);

  drawSectionTitle(REPORT_PDF_TEXT.maintenanceSection, "Bakım yükü ve son operasyon kayıtları");
  drawMetricCards([
    {
      label: REPORT_PDF_TEXT.upcomingMaintenanceLabel,
      value: String(upcomingMaintenanceCount),
      note: "Önümüzdeki 30 gün içinde planlanan aktif bakım kuralları.",
    },
    {
      label: REPORT_PDF_TEXT.overdueMaintenanceLabel,
      value: String(overdueMaintenanceCount),
      note: "Bugün itibarıyla geciken aktif bakım kuralları.",
    },
  ]);

  drawTable(
    REPORT_PDF_TEXT.recentMaintenanceSection,
    [
      REPORT_PDF_TEXT.dateHeader,
      REPORT_PDF_TEXT.assetHeader,
      REPORT_PDF_TEXT.typeHeader,
      REPORT_PDF_TEXT.costHeader,
    ],
    recentServiceRows.map((service) => [
      toTrDate(service.service_date),
      assetNameById.get(asSafeText(service.asset_id, "")) ?? asSafeText(service.asset_name, REPORT_PDF_TEXT.unknownValueLabel),
      asSafeText(service.service_type, "-"),
      formatCurrency(asMoney(service.cost)),
    ]),
    [85, 150, 180, 100],
  );

  drawSectionTitle(REPORT_PDF_TEXT.costAnalysisSection, "Servis ve gider tarafındaki finansal görünüm");
  drawMetricCards([
    {
      label: REPORT_PDF_TEXT.totalCostLabel,
      value: formatCurrency(totalCost),
      note: `${servicesInRange.length} servis kaydının toplam maliyeti.`,
    },
    {
      label: REPORT_PDF_TEXT.expenseTotalLabel,
      value: formatCurrency(expenseTotal),
      note: "Gider kayıtlarından gelen toplam tutar.",
    },
    {
      label: REPORT_PDF_TEXT.maintenanceCostLabel,
      value: formatCurrency(maintenanceCost),
      note: "Servis maliyetleri ile gider toplamlarının birleşimi.",
    },
    {
      label: REPORT_PDF_TEXT.averageCostLabel,
      value: formatCurrency(averageCost),
      note: "Servis kaydı başına ortalama maliyet.",
    },
  ]);

  drawSectionTitle(REPORT_PDF_TEXT.documentSection, "Belge kapsamı ve eksik dosya görünümü");
  drawMetricCards([
    {
      label: REPORT_PDF_TEXT.documentedAssetLabel,
      value: String(documentedAssetCount),
      note: "En az bir belgeye sahip varlık sayısı.",
    },
    {
      label: REPORT_PDF_TEXT.missingDocumentLabel,
      value: String(missingDocumentCount),
      note: "Henüz belge eklenmemiş varlık sayısı.",
    },
    {
      label: REPORT_PDF_TEXT.documentCountLabel,
      value: String(documentsInRange.length),
      note: "Seçili aralıkta eklenen toplam belge.",
    },
    {
      label: REPORT_PDF_TEXT.serviceCountLabel,
      value: String(servicesInRange.length),
      note: "Skor analizine dahil edilen servis kayıtları.",
    },
  ]);

  drawSectionTitle(REPORT_PDF_TEXT.scoreSection, "Operasyonel kaliteyi özetleyen skor görünümü");
  drawMetricCards([
    {
      label: REPORT_PDF_TEXT.overallScoreLabel,
      value: `${scoreAnalysis.overallScore}/100`,
      note: `Skor seviyesi: ${scoreAnalysis.scoreLabel}`,
    },
    {
      label: "Aktif alt skor",
      value: String(scoreSections.length),
      note: "Veri bulunan başlıklar genel skora dahil edildi.",
    },
  ]);

  drawTable(
    REPORT_PDF_TEXT.subScoresSection,
    [REPORT_PDF_TEXT.assetHeader, REPORT_PDF_TEXT.scoreHeader, REPORT_PDF_TEXT.summaryHeader],
    scoreSections.map((section) => [section.label, `${section.score}/100`, section.summary]),
    [135, 70, 310],
  );

  drawWrappedText(REPORT_PDF_TEXT.scoreCommentLabel, scoreComment);
  drawDivider();

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
    [230, 75, 75, 135],
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
      ...sortedServices.map((service) => [
        toTrDate(service.service_date),
        assetNameById.get(asSafeText(service.asset_id, "")) ?? asSafeText(service.asset_name, REPORT_PDF_TEXT.unknownValueLabel),
        asSafeText(service.service_type, "-"),
        formatCurrency(asMoney(service.cost)),
      ]),
      [REPORT_PDF_TEXT.totalRowLabel, "-", "-", formatCurrency(totalCost)],
    ],
    [85, 150, 180, 100],
  );

  drawTable(
    REPORT_PDF_TEXT.documentDetailSection,
    [REPORT_PDF_TEXT.uploadHeader, REPORT_PDF_TEXT.assetHeader, REPORT_PDF_TEXT.fileHeader],
    sortedDocuments.map((docRow) => [
      toTrDate(docRow.uploaded_at),
      assetNameById.get(asSafeText(docRow.asset_id, "")) ?? asSafeText(docRow.asset_name, REPORT_PDF_TEXT.unknownAssetLabel),
      asSafeText(docRow.file_name, "-"),
    ]),
    [95, 160, 260],
  );

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(left, pageHeight - 26, left + contentWidth, pageHeight - 26);
    doc.setFont("NotoSansUnicode", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(REPORT_PDF_TEXT.footerLabel, left, pageHeight - 14);
    doc.text(`${page}/${totalPages}`, pageWidth - right, pageHeight - 14, { align: "right" });
  }

  doc.save(`assetly-rapor-${startDate}-${endDate}.pdf`);
}
