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

  return `Güncellenen bilgiler: ${[...new Set(changedFields)].join(", ")}.`;
};

const resolveDocumentTypeLabel = (value: unknown) => {
  const normalized = toSafeString(value).toLocaleLowerCase("tr-TR");
  return documentTypeLabelByKey[normalized] ?? "Belge";
};

const resolveTypeFromEvent = (
  triggerType: string,
  payload: Record<string, unknown> | null,
): NotificationType => {
  if (triggerType === "maintenance_7_days") {
    return "Bakım";
  }

  if (triggerType === "warranty_30_days") {
    return "Garanti";
  }

  if (triggerType === "subscription_due" || triggerType === "expense_threshold") {
    return "Ödeme";
  }

  if (toSafeString(payload?.document_type).length > 0) {
    return "Belge";
  }

  return "Sistem";
};

const resolveText = (
  triggerType: string,
  payload: Record<string, unknown> | null,
): NotificationText => {
  const assetName = toSafeString(payload?.asset_name);
  const assetSubject = assetName ? `${assetName} varlığınız` : "Varlığınız";
  const notificationKind = toSafeString(payload?.notification_kind);
  const ruleTitle = toSafeString(payload?.rule_title, "planlı bakım");
  const warrantyDate = formatDate(toSafeString(payload?.warranty_end_date));
  const nextDueDate = formatDate(toSafeString(payload?.next_due_date));
  const serviceType = toSafeString(payload?.service_type, "servis");
  const subscriptionName = toSafeString(payload?.subscription_name, "abonelik");
  const providerName = toSafeString(payload?.provider_name);
  const nextBillingDate = formatDate(toSafeString(payload?.next_billing_date));
  const changedFieldsText = resolveChangedFieldsText(payload?.changed_fields);

  if (notificationKind === "asset_created") {
    return {
      title: "Yeni varlık eklendi",
      description: `${assetSubject} sisteme başarıyla eklendi.`,
    };
  }

  if (notificationKind === "asset_updated") {
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

const resolveReadStatusFromEvent = (status: string): NotificationStatus => {
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

  if (toSafeString(payload?.document_type).length > 0) {
    return "/documents";
  }

  return "";
};

export function mapAutomationEventToNotification(
  input: AutomationEventNotificationInput,
): NotificationRecord {
  const type = resolveTypeFromEvent(input.triggerType, input.payload);
  const text = resolveText(input.triggerType, input.payload);
  const actionHref = resolveActionHref(input.triggerType, input.payload, input.assetId);

  return {
    id: input.id,
    type,
    title: text.title,
    description: text.description,
    detail: text.detail,
    createdAt: input.createdAt,
    status: resolveReadStatusFromEvent(input.status),
    source: "automation",
    actionHref: actionHref || undefined,
    actionLabel: actionHref ? "Detaylara Bak" : undefined,
  };
}
