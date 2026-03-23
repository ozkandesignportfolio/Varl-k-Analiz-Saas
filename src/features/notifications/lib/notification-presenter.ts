import type {
  NotificationRecord,
  NotificationStatus,
  NotificationType,
} from "@/features/notifications/data/mock-notifications";

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

const notificationTypes = ["BakÄ±m", "Garanti", "Belge", "Ã–deme", "Sistem"] as const;

const fieldLabelByKey: Record<string, string> = {
  name: "Varlik adi",
  category: "Kategori",
  serial_number: "Seri numarasi",
  brand: "Marka",
  model: "Model",
  purchase_price: "Satin alma bedeli",
  purchase_date: "Satin alma tarihi",
  warranty_end_date: "Garanti bitis tarihi",
  photo_path: "Fotograf",
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

const formatDate = (value: string) => {
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

  return `Guncellenen bilgiler: ${[...new Set(changedFields)].join(", ")}.`;
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
    return "BakÄ±m";
  }

  if (triggerType === "warranty_30_days") {
    return "Garanti";
  }

  if (triggerType === "subscription_due" || triggerType === "expense_threshold") {
    return "Ã–deme";
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
  const assetSubject = assetName ? `${assetName} varliginiz` : "Varliginiz";
  const notificationKind = toSafeString(payload?.notification_kind);
  const ruleTitle = toSafeString(payload?.rule_title, "planli bakim");
  const warrantyDate = formatDate(toSafeString(payload?.warranty_end_date));
  const nextDueDate = formatDate(toSafeString(payload?.next_due_date));
  const serviceType = toSafeString(payload?.service_type, "servis");
  const subscriptionName = toSafeString(payload?.subscription_name, "abonelik");
  const providerName = toSafeString(payload?.provider_name);
  const nextBillingDate = formatDate(toSafeString(payload?.next_billing_date));
  const changedFieldsText = resolveChangedFieldsText(payload?.changed_fields);

  if (notificationKind === "asset_created") {
    return {
      title: "Yeni varlik eklendi",
      description: `${assetSubject} sisteme basariyla eklendi.`,
    };
  }

  if (notificationKind === "asset_updated") {
    return {
      title: "Varlik bilgileri guncellendi",
      description: `${assetSubject} guncellendi.`,
      detail: changedFieldsText || undefined,
    };
  }

  if (triggerType === "warranty_30_days") {
    return {
      title: "Garanti bitis tarihi yaklasiyor",
      description: warrantyDate
        ? `${assetSubject} icin garanti bitis tarihi ${warrantyDate}.`
        : `${assetSubject} icin garanti suresi yakinda sona eriyor.`,
    };
  }

  if (triggerType === "maintenance_7_days") {
    return {
      title: "Bakim zamani yaklasiyor",
      description: nextDueDate
        ? `${assetSubject} icin ${ruleTitle} tarihi ${nextDueDate}.`
        : `${assetSubject} icin yaklasan bir bakim plani bulunuyor.`,
    };
  }

  if (triggerType === "subscription_due") {
    const subscriptionLabel = providerName ? `${providerName} - ${subscriptionName}` : subscriptionName;
    return {
      title: "Odeme tarihi yaklasiyor",
      description: nextBillingDate
        ? `${subscriptionLabel} icin odeme tarihi ${nextBillingDate}.`
        : `${subscriptionLabel} icin odeme zamani yaklasiyor.`,
    };
  }

  if (triggerType === "service_log_created") {
    return {
      title: "Yeni servis kaydi eklendi",
      description: `${assetSubject} icin ${serviceType} kaydi olusturuldu.`,
    };
  }

  if (triggerType === "document_expiry_reminder") {
    const documentTypeLabel = resolveDocumentTypeLabel(payload?.document_type);
    const expiryDate = formatDate(
      toSafeString(payload?.expiry_date ?? payload?.expires_at ?? payload?.document_expiry_date),
    );
    return {
      title: "Belge suresi dolmak uzere",
      description: expiryDate
        ? `${assetSubject} icin ${documentTypeLabel.toLocaleLowerCase("tr-TR")} tarihi ${expiryDate}.`
        : `${assetSubject} icin bir belgenin suresi yaklasiyor.`,
    };
  }

  if (triggerType === "expense_threshold") {
    return {
      title: "Gider kaydi kontrol gerektiriyor",
      description: "Belirlediginiz tutarin uzerinde bir gider kaydi olustu. Kontrol etmeniz onerilir.",
    };
  }

  if (toSafeString(payload?.document_type)) {
    const documentTypeLabel = resolveDocumentTypeLabel(payload?.document_type);
    return {
      title: "Belgeyle ilgili bir islem zamani geldi",
      description: assetName
        ? `${assetName} varliginiz icin ${documentTypeLabel.toLocaleLowerCase("tr-TR")} ile ilgili bir bildirim var.`
        : `${documentTypeLabel} ile ilgili bir bildirim var.`,
    };
  }

  return {
    title: "Sistem bildirimi",
    description: "Takip etmeniz gereken yeni bir gelisme var.",
  };
};

const resolveReadStatusFromEvent = (status: string) => {
  if (status === "completed") {
    return "Okundu";
  }

    return "OkunmadÄ±";
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

  const notificationKind = toSafeString(payload?.notification_kind);

  if (notificationKind === "asset_created" || notificationKind === "asset_updated") {
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
  input: AutomationEventNotificationInput,
): NotificationRecord {
  const type = resolveTypeFromEvent(input.triggerType, input.payload) as NotificationType;
  const text = resolveText(input.triggerType, input.payload);
  const actionHref = resolveActionHref(input.triggerType, input.payload, input.assetId);

  return {
    id: input.id,
    type,
    title: text.title,
    description: text.description,
    detail: text.detail,
    createdAt: input.createdAt,
    status: resolveReadStatusFromEvent(input.status) as NotificationStatus,
    source: "automation",
    actionHref: actionHref || undefined,
    actionLabel: actionHref ? "Detaylara Bak" : undefined,
  };
}
