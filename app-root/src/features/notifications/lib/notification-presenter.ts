import type {
  NotificationRecord,
  NotificationStatus,
  NotificationType,
} from "@/features/notifications/data/mock-notifications";
import { AppEventType } from "@/lib/events/app-event";

/**
 * DB payload'undan event kimliğini çözer. Tek kaynak `AppEventType`; payload'da
 * yer alabilecek geçerli değerler enum stringleridir (örn. `"ASSET_CREATED"`).
 * Tanımlanmamış veya yabancı değerlerde `null` döner; ikinci bir kelime sistemi
 * tanınmaz.
 */
const resolveAppEventType = (
  payload: Record<string, unknown> | null,
): AppEventType | null => {
  const raw = payload?.event_type;
  if (typeof raw !== "string") {
    return null;
  }
  return (Object.values(AppEventType) as string[]).includes(raw)
    ? (raw as AppEventType)
    : null;
};

export type AutomationEventNotificationInput = {
  id: string;
  assetId: string | null;
  triggerType: string;
  payload: Record<string, unknown> | null;
  status: string;
  createdAt: string;
};

type NotificationText = {
  title: string;
  description: string;
  detail?: string;
};

const notificationTypes = ["Bakım", "Garanti", "Belge", "Ödeme", "Sistem"] as const;

const fieldLabelByKey: Record<string, string> = {
  name: "Varlık adı",
  category: "Kategori",
  serial_number: "Seri numarası",
  brand: "Marka",
  model: "Model",
  purchase_price: "Satın alma bedeli",
  purchase_date: "Satın alma tarihi",
  warranty_end_date: "Garanti bitiş tarihi",
  photo_path: "Fotoğraf",
  qr_code: "QR kodu",
};

const documentTypeLabelByKey: Record<string, string> = {
  garanti: "Garanti belgesi",
  fatura: "Fatura",
  servis_formu: "Servis formu",
  diger: "Belge",
  "diğer": "Belge",
};

const toSafeString = (value: unknown, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toSafeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatDate = (value: string | null | undefined) => {
  if (!value || typeof value !== "string") {
    return "";
  }
  
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const resolveChangedFieldsText = (value: unknown) => {
  const changedFields = toSafeStringArray(value)
    .map((field) => fieldLabelByKey[field])
    .filter(Boolean);

  if (changedFields.length === 0) {
    return "";
  }

  return `Güncellenen bilgiler: ${[...new Set(changedFields)].join(", ")}.`;
};

const resolveDocumentTypeLabel = (value: unknown) => {
  const normalized = toSafeString(value).toLocaleLowerCase("tr-TR");
  return documentTypeLabelByKey[normalized] ?? "Belge";
};

const resolveCustomType = (value: unknown): NotificationType | null => {
  const normalized = toSafeString(value);

  if ((notificationTypes as readonly string[]).includes(normalized)) {
    return normalized as NotificationType;
  }

  return null;
};

const resolveTypeFromEvent = (
  triggerType: string,
  payload: Record<string, unknown> | null,
) => {
  const customType = resolveCustomType(payload?.type);
  if (customType) {
    return customType;
  }

  if (triggerType === "maintenance_7_days") {
    return "Bakım";
  }

  if (triggerType === "warranty_30_days") {
    return "Garanti";
  }

  if (triggerType === "subscription_due" || triggerType === "expense_threshold") {
    return "Ödeme";
  }

  if (triggerType === "document_expiry_reminder" || toSafeString(payload?.document_type).length > 0) {
    return "Belge";
  }

  return "Sistem";
};

const resolveText = (
  triggerType: string,
  payload: Record<string, unknown> | null,
): NotificationText => {
  const customTitle = toSafeString(payload?.title);
  const customMessage = toSafeString(payload?.message);
  if (customTitle && customMessage) {
    return {
      title: customTitle,
      description: customMessage,
      detail: toSafeString(payload?.detail) || undefined,
    };
  }

  const assetName = toSafeString(payload?.asset_name);
  const assetSubject = assetName ? `${assetName} varlığınız` : "Varlığınız";
  const appEventType = resolveAppEventType(payload);
  const ruleTitle = toSafeString(payload?.rule_title, "planlı bakım");
  const warrantyDate = formatDate(toSafeString(payload?.warranty_end_date));
  const nextDueDate = formatDate(toSafeString(payload?.next_due_date));
  const serviceType = toSafeString(payload?.service_type, "servis");
  const subscriptionName = toSafeString(payload?.subscription_name, "abonelik");
  const providerName = toSafeString(payload?.provider_name);
  const nextBillingDate = formatDate(toSafeString(payload?.next_billing_date));
  const changedFieldsText = resolveChangedFieldsText(payload?.changed_fields);

  if (appEventType === AppEventType.ASSET_CREATED) {
    return {
      title: "Yeni varlık eklendi",
      description: `${assetSubject} sisteme başarıyla eklendi.`,
    };
  }

  if (appEventType === AppEventType.ASSET_UPDATED) {
    return {
      title: "Varlık bilgileri güncellendi",
      description: `${assetSubject} güncellendi.`,
      detail: changedFieldsText || undefined,
    };
  }

  if (triggerType === "warranty_30_days") {
    return {
      title: "Garanti bitiş tarihi yaklaşıyor",
      description: warrantyDate
        ? `${assetSubject} için garanti bitiş tarihi ${warrantyDate}.`
        : `${assetSubject} için garanti süresi yakında sona eriyor.`,
    };
  }

  if (triggerType === "maintenance_7_days") {
    return {
      title: "Bakım zamanı yaklaşıyor",
      description: nextDueDate
        ? `${assetSubject} için ${ruleTitle} tarihi ${nextDueDate}.`
        : `${assetSubject} için yaklaşan bir bakım planı bulunuyor.`,
    };
  }

  if (triggerType === "subscription_due") {
    const subscriptionLabel = providerName ? `${providerName} - ${subscriptionName}` : subscriptionName;
    return {
      title: "Ödeme tarihi yaklaşıyor",
      description: nextBillingDate
        ? `${subscriptionLabel} için ödeme tarihi ${nextBillingDate}.`
        : `${subscriptionLabel} için ödeme zamanı yaklaşıyor.`,
    };
  }

  if (triggerType === "service_log_created") {
    return {
      title: "Yeni servis kaydı eklendi",
      description: `${assetSubject} için ${serviceType} kaydı oluşturuldu.`,
    };
  }

  if (triggerType === "document_expiry_reminder") {
    const documentTypeLabel = resolveDocumentTypeLabel(payload?.document_type);
    const expiryDate = formatDate(
      toSafeString(payload?.expiry_date ?? payload?.expires_at ?? payload?.document_expiry_date),
    );
    return {
      title: "Belge süresi dolmak üzere",
      description: expiryDate
        ? `${assetSubject} için ${documentTypeLabel.toLocaleLowerCase("tr-TR")} tarihi ${expiryDate}.`
        : `${assetSubject} için bir belgenin süresi yaklaşıyor.`,
    };
  }

  if (triggerType === "expense_threshold") {
    return {
      title: "Gider kaydı kontrol gerektiriyor",
      description: "Belirlediğiniz tutarın üzerinde bir gider kaydı oluştu. Kontrol etmeniz önerilir.",
    };
  }

  if (toSafeString(payload?.document_type)) {
    const documentTypeLabel = resolveDocumentTypeLabel(payload?.document_type);
    return {
      title: "Belgeyle ilgili bir işlem zamanı geldi",
      description: assetName
        ? `${assetName} varlığınız için ${documentTypeLabel.toLocaleLowerCase("tr-TR")} ile ilgili bir bildirim var.`
        : `${documentTypeLabel} ile ilgili bir bildirim var.`,
    };
  }

  return {
    title: "Sistem bildirimi",
    description: "Takip etmeniz gereken yeni bir gelişme var.",
  };
};

const resolveReadStatusFromEvent = (status: string) => {
  if (status === "completed") {
    return "Okundu";
  }

    return "Okunmadı";
};

const resolveActionHref = (
  triggerType: string,
  payload: Record<string, unknown> | null,
  assetId: string | null,
) => {
  const customActionHref = toSafeString(payload?.action_href);
  if (customActionHref) {
    return customActionHref;
  }

  const appEventType = resolveAppEventType(payload);

  if (
    appEventType === AppEventType.ASSET_CREATED ||
    appEventType === AppEventType.ASSET_UPDATED
  ) {
    return assetId ? `/assets/${assetId}` : "/assets";
  }

  if (triggerType === "maintenance_7_days") {
    return assetId ? `/maintenance?assetId=${encodeURIComponent(assetId)}` : "/maintenance";
  }

  if (triggerType === "warranty_30_days") {
    return assetId ? `/assets/${assetId}` : "/assets";
  }

  if (triggerType === "subscription_due") {
    return "/billing";
  }

  if (triggerType === "service_log_created") {
    return assetId ? `/services?assetId=${encodeURIComponent(assetId)}` : "/services";
  }

  if (triggerType === "expense_threshold") {
    return "/costs";
  }

  if (triggerType === "document_expiry_reminder" || toSafeString(payload?.document_type).length > 0) {
    return "/documents";
  }

  return "";
};

export function mapAutomationEventToNotification(
  input: AutomationEventNotificationInput | null | undefined,
): NotificationRecord | null {
  // Defensive: handle null/undefined input
  if (!input) {
    console.warn("[notification-presenter] mapAutomationEventToNotification received null input");
    return null;
  }

  // Defensive: ensure required fields exist
  if (!input.id || !input.triggerType) {
    console.warn("[notification-presenter] mapAutomationEventToNotification missing required fields", {
      hasId: !!input.id,
      hasTriggerType: !!input.triggerType,
    });
    return null;
  }

  try {
    const type = resolveTypeFromEvent(input.triggerType, input.payload) as NotificationType;
    const text = resolveText(input.triggerType, input.payload);
    const actionHref = resolveActionHref(input.triggerType, input.payload, input.assetId);

    // Ensure safe defaults
    const safeTitle = text.title || "Bildirim";
    const safeDescription = text.description || "Yeni bir bildirim var.";
    const safeCreatedAt = input.createdAt || new Date().toISOString();

    return {
      id: input.id,
      type,
      title: safeTitle,
      description: safeDescription,
      detail: text.detail,
      createdAt: safeCreatedAt,
      status: resolveReadStatusFromEvent(input.status) as NotificationStatus,
      source: "automation",
      actionHref: actionHref || undefined,
      actionLabel: actionHref ? "Detaylara Bakın" : undefined,
    };
  } catch (error) {
    console.error("[notification-presenter] mapAutomationEventToNotification error", {
      input,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
