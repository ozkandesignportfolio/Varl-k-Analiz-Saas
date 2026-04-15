export type TriggerType =
  | "warranty_30_days"
  | "maintenance_7_days"
  | "service_log_created"
  | "subscription_due"
  | "expense_threshold"
  | "document_expiry_reminder";
export type ActionType = "email" | "push" | "push_notification" | "pdf_report";

export type AutomationEvent = {
  id: string;
  user_id: string;
  asset_id: string | null;
  rule_id: string | null;
  service_log_id: string | null;
  trigger_type: TriggerType;
  actions: ActionType[];
  payload: Record<string, unknown>;
};

export type NotificationPreferenceKey =
  | "maintenance"
  | "warranty"
  | "document"
  | "documentExpiry"
  | "service"
  | "payment"
  | "system";

export type AutomationEventContext = {
  appUrl?: string | null;
  assetName?: string | null;
  assetCategory?: string | null;
  assetStatus?: string | null;
  organizationName?: string | null;
  recipientName?: string | null;
};

export type EmailNotificationMessage = {
  title: string;
  summary: string;
  subject: string;
  text: string;
  html: string;
  ctaUrl: string | null;
  preferenceKey: NotificationPreferenceKey;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const toTrimmedString = (value: unknown, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const formatDate = (value: unknown) => {
  const rawValue = toTrimmedString(value);
  if (!rawValue) {
    return "";
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return rawValue;
  }

  return dateFormatter.format(parsed);
};

const formatDateOrFallback = (value: unknown, fallback: string) => {
  const formatted = formatDate(value);
  return formatted || fallback;
};

const calculateRemainingDays = (value: unknown) => {
  const explicitDays = toNumber(value);
  if (explicitDays !== null) {
    return Math.round(explicitDays);
  }

  const rawValue = toTrimmedString(value);
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return Math.round((target - startOfToday) / 86_400_000);
};

const formatRemainingDays = (value: number | null) => {
  if (value === null) {
    return "";
  }

  if (value < 0) {
    return `${Math.abs(value)} gün gecikti`;
  }

  if (value === 0) {
    return "Bugün";
  }

  if (value === 1) {
    return "1 gün kaldı";
  }

  return `${value} gün kaldı`;
};

const formatRequiredRemainingDays = (value: number | null) => {
  const formatted = formatRemainingDays(value);
  return formatted || "Uygulanmaz";
};

const normalizeAppUrl = (value: string | null | undefined) => {
  const normalized = toTrimmedString(value);
  return normalized ? normalized.replace(/\/+$/, "") : "";
};

const resolveAbsoluteUrl = (appUrl: string | null | undefined, path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = normalizeAppUrl(appUrl);
  return baseUrl ? `${baseUrl}${normalizedPath}` : null;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const resolveUrgency = (
  remainingDays: number | null,
  fallback: "Düşük" | "Orta" | "Yüksek" = "Orta",
) => {
  if (remainingDays === null) {
    return fallback;
  }

  if (remainingDays <= 3) {
    return "Yüksek";
  }

  if (remainingDays <= 14) {
    return "Orta";
  }

  return "Düşük";
};

const resolveNotificationKind = (event: AutomationEvent) => {
  const explicitKind = toTrimmedString(event.payload?.notification_kind);
  if (explicitKind) {
    return explicitKind;
  }

  if (event.trigger_type === "document_expiry_reminder") {
    return "document_expiry";
  }

  return "";
};

const resolvePreferenceKey = (event: AutomationEvent): NotificationPreferenceKey => {
  const notificationKind = resolveNotificationKind(event);

  if (notificationKind === "asset_created" || notificationKind === "asset_updated") {
    return "system";
  }

  if (notificationKind === "document_uploaded") {
    return "document";
  }

  if (notificationKind === "document_expiry" || event.trigger_type === "document_expiry_reminder") {
    return "documentExpiry";
  }

  if (event.trigger_type === "maintenance_7_days") {
    return "maintenance";
  }

  if (event.trigger_type === "warranty_30_days") {
    return "warranty";
  }

  if (event.trigger_type === "subscription_due" || event.trigger_type === "expense_threshold") {
    return "payment";
  }

  if (event.trigger_type === "service_log_created") {
    return "service";
  }

  return "system";
};

const resolveActionHref = (event: AutomationEvent, appUrl?: string | null) => {
  const explicitHref = toTrimmedString(event.payload?.action_href);
  if (explicitHref) {
    return explicitHref.startsWith("http://") || explicitHref.startsWith("https://")
      ? explicitHref
      : resolveAbsoluteUrl(appUrl, explicitHref);
  }

  const notificationKind = resolveNotificationKind(event);

  if (notificationKind === "asset_created" || notificationKind === "asset_updated") {
    return resolveAbsoluteUrl(appUrl, event.asset_id ? `/assets/${event.asset_id}` : "/assets");
  }

  if (notificationKind === "document_uploaded" || notificationKind === "document_expiry") {
    return resolveAbsoluteUrl(appUrl, "/documents");
  }

  if (event.trigger_type === "maintenance_7_days") {
    return resolveAbsoluteUrl(appUrl, event.asset_id ? `/maintenance?assetId=${event.asset_id}` : "/maintenance");
  }

  if (event.trigger_type === "warranty_30_days") {
    return resolveAbsoluteUrl(appUrl, event.asset_id ? `/assets/${event.asset_id}` : "/assets");
  }

  if (event.trigger_type === "subscription_due") {
    return resolveAbsoluteUrl(appUrl, "/billing");
  }

  if (event.trigger_type === "expense_threshold") {
    return resolveAbsoluteUrl(appUrl, "/costs");
  }

  if (event.trigger_type === "service_log_created") {
    return resolveAbsoluteUrl(appUrl, event.asset_id ? `/services?assetId=${event.asset_id}` : "/services");
  }

  return resolveAbsoluteUrl(appUrl, "/notifications");
};

const buildRequiredDetails = (params: {
  assetName: string;
  dateLabel: string;
  remainingDays: number | null;
  status: string;
  ctaUrl: string | null;
  summary: string;
  templateType: string;
  extraDetails?: Array<[string, string]>;
}) => {
  return [
    ["Varlik adi", params.assetName],
    ["Tarih", params.dateLabel],
    ["Kalan gün", formatRequiredRemainingDays(params.remainingDays)],
    ["Durum", params.status],
    ["Aksiyon linki", params.ctaUrl || "Baglanti bulunamadi"],
    ["Tip", params.templateType],
    ["Ozet", params.summary],
    ...(params.extraDetails ?? []),
  ];
};

const renderTextEmail = (params: {
  greeting: string;
  intro: string;
  details: Array<[string, string]>;
  actionSummary: string;
  ctaUrl: string | null;
}) => {
  const detailLines = params.details.map(([label, value]) => `- ${label}: ${value}`);

  return [
    params.greeting,
    "",
    params.intro,
    "",
    "Ozet",
    ...detailLines,
    "",
    "Aksiyon",
    params.actionSummary,
    ...(params.ctaUrl ? ["", `Detay: ${params.ctaUrl}`] : []),
  ].join("\n");
};

const renderHtmlEmail = (params: {
  title: string;
  greeting: string;
  intro: string;
  details: Array<[string, string]>;
  actionSummary: string;
  ctaUrl: string | null;
}) => {
  const detailsHtml = params.details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:600;">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const ctaHtml = params.ctaUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Bildirim Detayini Ac</a></p>`
    : "";

  return [
    "<!doctype html>",
    "<html><body style=\"margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;\">",
    "<div style=\"max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;\">",
    `<div style="padding:24px 24px 12px;background:#0f172a;color:#ffffff;"><h1 style="margin:0;font-size:20px;">${escapeHtml(params.title)}</h1></div>`,
    `<div style="padding:24px;"><p style="margin:0 0 16px;">${escapeHtml(params.greeting)}</p>`,
    `<p style="margin:0 0 20px;color:#334155;line-height:1.6;">${escapeHtml(params.intro)}</p>`,
    `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">${detailsHtml}</table>`,
    `<p style="margin:20px 0 0;color:#334155;line-height:1.6;"><strong>Aksiyon:</strong> ${escapeHtml(params.actionSummary)}</p>`,
    ctaHtml,
    "</div></div></body></html>",
  ].join("");
};

export function buildEmailMessage(
  event: AutomationEvent,
  context: AutomationEventContext = {},
): EmailNotificationMessage {
  const notificationKind = resolveNotificationKind(event);
  const assetName = toTrimmedString(context.assetName ?? event.payload?.asset_name, "Bagli varlik yok");
  const assetCategory = toTrimmedString(context.assetCategory ?? event.payload?.asset_category);
  const assetStatus = toTrimmedString(context.assetStatus ?? event.payload?.current_status);
  const organizationName = toTrimmedString(context.organizationName, "AssetCare");
  const recipientName = toTrimmedString(context.recipientName, "Merhaba");
  const ctaUrl = resolveActionHref(event, context.appUrl);
  const preferenceKey = resolvePreferenceKey(event);
  const defaultDateLabel = formatDateOrFallback(new Date().toISOString(), "Belirtilmedi");

  let title = "Sistem bildirimi";
  let subject = `${organizationName}: Yeni bildirim`;
  let summary = "Takip etmeniz gereken yeni bir gelisme var.";
  let intro = summary;
  let actionSummary = "Detaylari kontrol edin ve gerekli aksiyonu planlayin.";
  let templateType = "System";
  let eventDateLabel = defaultDateLabel;
  let remainingDays: number | null = calculateRemainingDays(
    event.payload?.remaining_days ?? event.payload?.days_left,
  );
  let statusLabel = assetStatus || toTrimmedString(event.payload?.status, "Takip bekleniyor");
  let extraDetails: Array<[string, string]> = [];

  if (notificationKind === "asset_created") {
    templateType = "Asset change";
    eventDateLabel = formatDateOrFallback(
      event.payload?.event_date ?? event.payload?.created_at ?? event.payload?.updated_at,
      defaultDateLabel,
    );
    statusLabel = assetStatus || "Yeni kayıt";
    title = "Yeni varlık eklendi";
    subject = `${organizationName}: Yeni varlık kaydı oluşturuldu - ${assetName}`;
    summary = `${assetName} varlığı sisteme eklendi ve kayıt başarıyla oluşturuldu.`;
    intro = `${assetName} varlığı için yeni bir kayıt oluşturuldu. Kaydın temel bilgilerini gözden geçirmeniz ve eksik alan varsa tamamlamanız önerilir.`;
    actionSummary = "Yeni varlık kaydını açıp kategori, garanti ve satın alma bilgilerini doğrulayın.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Oncelik", "Orta"],
    ];
  } else if (notificationKind === "asset_updated") {
    const changedFields = toStringArray(event.payload?.changed_fields);
    const changedFieldsText = changedFields.length > 0 ? changedFields.join(", ") : "Guncellenen alan bilgisi yok";
    templateType = "Asset change";
    eventDateLabel = formatDateOrFallback(
      event.payload?.event_date ?? event.payload?.updated_at ?? event.payload?.created_at,
      defaultDateLabel,
    );
    statusLabel = assetStatus || "Guncellendi";
    title = "Varlık bilgileri güncellendi";
    subject = `${organizationName}: Varlık güncellendi - ${assetName}`;
    summary = `${assetName} varlığına ait bilgiler güncellendi.`;
    intro = `${assetName} varlığı için bir değişiklik kaydedildi. Özellikle operasyonel alanlar değişti ise ekibinizin kaydı doğrulaması iyi olur.`;
    actionSummary = "Guncellenen alanlari kontrol edin ve degisikligin operasyonel etkisini onaylayin.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Guncellenen alanlar", changedFieldsText],
      ["Oncelik", "Orta"],
    ];
  } else if (notificationKind === "document_uploaded") {
    const documentType = toTrimmedString(event.payload?.document_type, "Belge");
    const documentDateSource =
      event.payload?.uploaded_at ??
      event.payload?.document_date ??
      event.payload?.created_at ??
      event.payload?.expiry_date ??
      event.payload?.expires_at ??
      event.payload?.document_expiry_date;
    const documentExpiryDate = formatDate(
      event.payload?.expiry_date ?? event.payload?.expires_at ?? event.payload?.document_expiry_date,
    );
    templateType = "Document";
    eventDateLabel = formatDateOrFallback(documentDateSource, defaultDateLabel);
    remainingDays = calculateRemainingDays(
      event.payload?.remaining_days ??
        event.payload?.days_left ??
        event.payload?.expiry_date ??
        event.payload?.expires_at ??
        event.payload?.document_expiry_date,
    );
    statusLabel = assetStatus || "Yeni yükleme";
    title = "Yeni belge yüklendi";
    subject = `${organizationName}: Belge kaydı oluşturuldu - ${assetName}`;
    summary = `${assetName} için yeni bir belge kaydı oluşturuldu.`;
    intro = `${assetName} varlığı ile ilişkili yeni bir belge sisteme eklendi. Belgenin tipi ve içeriğini kontrol etmeniz önerilir.`;
    actionSummary = "Belgeyi açıp dosyanın doğru varlığa ve doğru belge tipine bağlandığını doğrulayın.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Belge tipi", documentType],
      ...(documentExpiryDate ? [["Geçerlilik tarihi", documentExpiryDate] as [string, string]] : []),
      ["Öncelik", "Düşük"],
    ];
  } else if (notificationKind === "document_expiry" || event.trigger_type === "document_expiry_reminder") {
    const documentType = toTrimmedString(event.payload?.document_type, "Belge");
    const expiryDate = formatDate(
      event.payload?.expiry_date ?? event.payload?.expires_at ?? event.payload?.document_expiry_date,
    );
    remainingDays = calculateRemainingDays(
      event.payload?.remaining_days ??
        event.payload?.days_left ??
        event.payload?.expiry_date ??
        event.payload?.expires_at ??
        event.payload?.document_expiry_date,
    );
    templateType = "Document";
    eventDateLabel = expiryDate || defaultDateLabel;
    statusLabel = assetStatus || "Yenileme gerekiyor";
    const urgency = resolveUrgency(remainingDays);
    title = "Belge geçerlilik süresi yaklaşıyor";
    subject = `${organizationName}: Belge süresi doluyor - ${assetName}`;
    summary = `${assetName} için kayıtlı ${documentType.toLocaleLowerCase("tr-TR")} belgesinin geçerlilik süresi yaklaşıyor.`;
    intro = `${assetName} varlığı ile ilişkili ${documentType.toLocaleLowerCase("tr-TR")} belgesinin geçerlilik tarihi yaklaşıyor. Operasyonel kesinti yaşamamak için yenileme sürecini planlamanız tavsiye edilir.`;
    actionSummary = "Belgeyi yenileyin veya yeni kopyasını yükleyin; gerekirse sorumlu ekibi bilgilendirin.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Belge tipi", documentType],
      ...(expiryDate ? [["Son geçerlilik tarihi", expiryDate] as [string, string]] : []),
      ["Öncelik", urgency],
    ];
  } else if (event.trigger_type === "warranty_30_days") {
    const warrantyDate = formatDate(event.payload?.warranty_end_date);
    remainingDays = calculateRemainingDays(event.payload?.days_left ?? event.payload?.warranty_end_date);
    templateType = "Warranty";
    eventDateLabel = warrantyDate || defaultDateLabel;
    statusLabel = assetStatus || "Garanti bitiyor";
    const urgency = resolveUrgency(remainingDays);
    title = "Garanti bitiş tarihi yaklaşıyor";
    subject = `${organizationName}: Garanti hatırlatması - ${assetName}`;
    summary = `${assetName} için garanti süresi yaklaşıyor.`;
    intro = `${assetName} varlığının garanti kapsamı yakında sona erecek. Garanti yenilemesi, servis planlaması veya değişim kararı için kaydı önceden değerlendirmeniz iyi olur.`;
    actionSummary = "Garanti bitiş tarihini kontrol edin ve gerekli ise servis veya yenileme planını başlatın.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ...(warrantyDate ? [["Garanti bitiş tarihi", warrantyDate] as [string, string]] : []),
      ["Öncelik", urgency],
    ];
  } else if (event.trigger_type === "maintenance_7_days") {
    const ruleTitle = toTrimmedString(event.payload?.rule_title, "Planlı bakım");
    const dueDate = formatDate(event.payload?.next_due_date);
    remainingDays = calculateRemainingDays(event.payload?.days_left ?? event.payload?.next_due_date);
    templateType = "Maintenance";
    eventDateLabel = dueDate || defaultDateLabel;
    statusLabel = assetStatus || "Bakım planlandı";
    const urgency = resolveUrgency(remainingDays);
    title = "Bakım tarihi yaklaşıyor";
    subject = `${organizationName}: Bakım hatırlatması - ${assetName}`;
    summary = `${assetName} için planlı bakım tarihi yaklaşıyor.`;
    intro = `${assetName} varlığına ait ${ruleTitle.toLocaleLowerCase("tr-TR")} kaydı için yaklaşan bir bakım tarihi var. Planlanan tarihten önce servis randevusunu ve gerekli parçayı netleştirmeniz önerilir.`;
    actionSummary = "Bakım planını açın, tarihi kontrol edin ve servis iş emrini oluşturun veya güncelleyin.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Bakım planı", ruleTitle],
      ...(dueDate ? [["Planlanan tarih", dueDate] as [string, string]] : []),
      ["Öncelik", urgency],
    ];
  } else if (event.trigger_type === "subscription_due") {
    const providerName = toTrimmedString(event.payload?.provider_name, "Sağlayıcı");
    const subscriptionName = toTrimmedString(event.payload?.subscription_name, "Abonelik");
    const planName = toTrimmedString(event.payload?.plan_name);
    const billingCycle = toTrimmedString(event.payload?.billing_cycle);
    const billingDate = formatDate(event.payload?.next_billing_date);
    const amount = toTrimmedString(event.payload?.amount);
    const currency = toTrimmedString(event.payload?.currency, "TRY");
    remainingDays = calculateRemainingDays(event.payload?.days_left ?? event.payload?.next_billing_date);
    templateType = "Billing";
    eventDateLabel = billingDate || defaultDateLabel;
    statusLabel = toTrimmedString(event.payload?.status, "Ödeme takibi gerekli");
    const urgency = resolveUrgency(remainingDays, "Yüksek");
    title = "Ödeme tarihi geldi";
    subject = `${organizationName}: Ödeme hatırlatması - ${providerName} / ${subscriptionName}`;
    summary = `${providerName} / ${subscriptionName} ödemesi için takip gereken bir tarih var.`;
    intro = `${providerName} sağlayıcısına ait ${subscriptionName} ödemesi için planlanan faturalama tarihi geldi veya yaklaştı. Gecikme yaşamamak için ödeme detaylarını ve abonelik durumunu şimdi kontrol etmeniz önerilir.`;
    actionSummary = "Faturalama kaydını açın, ödeme durumunu doğrulayın ve gerekiyorsa muhasebe veya satın alma ekibiyle paylaşın.";
    extraDetails = [
      ["Sağlayıcı", providerName],
      ["Abonelik", subscriptionName],
      ...(planName ? [["Plan", planName] as [string, string]] : []),
      ...(billingCycle ? [["Dönem", billingCycle] as [string, string]] : []),
      ...(billingDate ? [["Ödeme tarihi", billingDate] as [string, string]] : []),
      ...(amount ? [["Tutar", `${amount} ${currency}`] as [string, string]] : []),
      ["Öncelik", urgency],
    ];
  } else if (event.trigger_type === "expense_threshold") {
    const expenseTitle = toTrimmedString(event.payload?.title, "Gider");
    const amount = toTrimmedString(event.payload?.amount);
    const currency = toTrimmedString(event.payload?.currency, "TRY");
    const threshold = toTrimmedString(event.payload?.threshold);
    templateType = "Billing";
    eventDateLabel = formatDateOrFallback(
      event.payload?.expense_date ?? event.payload?.created_at ?? event.payload?.event_date,
      defaultDateLabel,
    );
    remainingDays = calculateRemainingDays(
      event.payload?.remaining_days ?? event.payload?.days_left ?? event.payload?.due_date,
    );
    statusLabel = "Kontrol bekliyor";
    title = "Yüksek tutarlı gider kaydı";
    subject = `${organizationName}: Yüksek gider uyarısı - ${expenseTitle}`;
    summary = `${expenseTitle} için belirlenen eşiği aşan bir gider kaydı oluşturuldu.`;
    intro = `${expenseTitle} başlıklı gider kaydı, tanımlı kontrol eşiğinin üzerinde oluşturuldu. Bu kaydın doğrulanması ve gerekiyorsa yönetsel onaya yönlendirilmesi tavsiye edilir.`;
    actionSummary = "Gider kaydını inceleyin, belge ve onay akışını tamamlayın ve beklenmeyen masraf varsa kaynağını kontrol edin.";
    extraDetails = [
      ...(assetName !== "Bağlı varlık yok" ? [["Varlık bağlamı", assetName] as [string, string]] : []),
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Kayıt", expenseTitle],
      ...(amount ? [["Tutar", `${amount} ${currency}`] as [string, string]] : []),
      ...(threshold ? [["Eşik", `${threshold} ${currency}`] as [string, string]] : []),
      ["Öncelik", "Yüksek"],
    ];
  } else if (event.trigger_type === "service_log_created") {
    const serviceType = toTrimmedString(event.payload?.service_type, "Servis");
    const serviceDate = formatDate(event.payload?.service_date);
    templateType = "System";
    eventDateLabel = serviceDate || formatDateOrFallback(
      event.payload?.event_date ?? event.payload?.created_at,
      defaultDateLabel,
    );
    remainingDays = calculateRemainingDays(event.payload?.remaining_days ?? event.payload?.days_left);
    statusLabel = assetStatus || "Servis kaydı açıldı";
    title = "Yeni servis kaydı oluşturuldu";
    subject = `${organizationName}: Servis kaydı oluşturuldu - ${assetName}`;
    summary = `${assetName} için yeni bir servis kaydı oluşturuldu.`;
    intro = `${assetName} varlığı için ${serviceType.toLocaleLowerCase("tr-TR")} kaydı sisteme eklendi. Yapılan işlemin detaylarını ve varsa ilgili bakım planını gözden geçirmeniz önerilir.`;
    actionSummary = "Servis kaydını açın, notları ve maliyet alanlarını kontrol edin; gerekiyorsa ilgili bakım kuralını güncelleyin.";
    extraDetails = [
      ...(assetCategory ? [["Kategori", assetCategory] as [string, string]] : []),
      ["Servis tipi", serviceType],
      ...(serviceDate ? [["Servis tarihi", serviceDate] as [string, string]] : []),
      ["Öncelik", "Düşük"],
    ];
  } else {
    templateType = "System";
    eventDateLabel = formatDateOrFallback(
      event.payload?.event_date ?? event.payload?.created_at ?? event.payload?.date,
      defaultDateLabel,
    );
    statusLabel = assetStatus || toTrimmedString(event.payload?.status, "Takip bekleniyor");
    extraDetails = [
      ["Tetikleyici", event.trigger_type],
    ];
  }

  const details = buildRequiredDetails({
    assetName,
    dateLabel: eventDateLabel,
    remainingDays,
    status: statusLabel,
    ctaUrl,
    summary,
    templateType,
    extraDetails,
  });

  const greeting = recipientName === "Merhaba" ? "Merhaba," : `Merhaba ${recipientName},`;
  const text = renderTextEmail({
    greeting,
    intro,
    details,
    actionSummary,
    ctaUrl,
  });
  const html = renderHtmlEmail({
    title,
    greeting,
    intro,
    details,
    actionSummary,
    ctaUrl,
  });

  return {
    title,
    summary,
    subject,
    text,
    html,
    ctaUrl,
    preferenceKey,
  };
}

export function buildMessage(
  event: AutomationEvent,
  context: AutomationEventContext = {},
): { title: string; body: string } {
  const message = buildEmailMessage(event, context);
  return {
    title: message.title,
    body: message.summary,
  };
}

export function resolveNotificationPreferenceKey(event: AutomationEvent): NotificationPreferenceKey {
  return resolvePreferenceKey(event);
}
