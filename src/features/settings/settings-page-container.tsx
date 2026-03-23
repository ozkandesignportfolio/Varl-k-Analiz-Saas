"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { usePlanContext } from "@/contexts/PlanContext";
import {
  NotificationPrefs,
  type NotificationPrefsState,
  type NotificationReminderDaysState,
} from "@/features/settings/components/NotificationPrefs";
import { PlanUsageCard } from "@/features/settings/components/PlanUsageCard";
import { ProfileForm, type ProfileFormValues } from "@/features/settings/components/ProfileForm";
import { SecuritySection } from "@/features/settings/components/SecuritySection";
import { SettingsTabs } from "@/features/settings/components/SettingsTabs";
import { resolveSettingsTab } from "@/features/settings/utils/resolve-settings-tab";
import { PAYMENT_TEXT } from "@/constants/ui-text";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

const defaultProfile: ProfileFormValues = {
  fullName: "",
  email: "",
};

type OrganizationSettingsValues = {
  name: string;
  industry: string;
  usageType: string;
  teamType: string;
  defaultCurrency: string;
  contactEmail: string;
  note: string;
};

const defaultOrganization: OrganizationSettingsValues = {
  name: "Kişisel Çalışma Alanı",
  industry: "",
  usageType: "",
  teamType: "",
  defaultCurrency: "TRY",
  contactEmail: "",
  note: "",
};

const defaultNotificationPrefs: NotificationPrefsState = {
  maintenance: true,
  warranty: true,
  document: true,
  documentExpiry: true,
  service: true,
  payment: true,
  system: true,
  inApp: true,
  email: false,
  frequency: "Anında",
};

const defaultNotificationReminderDays: NotificationReminderDaysState = {
  maintenanceDaysBefore: 3,
  warrantyDaysBefore: 3,
  documentDaysBefore: 3,
  billingDaysBefore: 3,
};

const MAX_NOTIFICATION_REMINDER_DAYS = 365;

const ACCOUNT_DELETE_CONFIRM_KEYWORD = "SİL";
const INPUT_CLASS_NAME =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300 disabled:opacity-70";
const SELECT_CLASS_NAME = `${INPUT_CLASS_NAME} appearance-none`;
const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-24 resize-y`;
const ORGANIZATION_INDUSTRY_OPTIONS = [
  "Genel işletme",
  "Apartman / site yönetimi",
  "Servis operasyonu",
  "Üretim / depo",
  "Ofis / mağaza",
  "Diğer",
] as const;
const ORGANIZATION_USAGE_OPTIONS = [
  "Genel varlık takibi",
  "Bakım planlama",
  "Belge ve garanti takibi",
  "Abonelik / fatura takibi",
] as const;
const ORGANIZATION_TEAM_TYPE_OPTIONS = ["Bireysel kullanım", "Küçük ekip", "İşletme / şube"] as const;
const ORGANIZATION_CURRENCY_OPTIONS = ["TRY", "USD", "EUR"] as const;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const toNotificationFrequency = (
  value: unknown,
  fallback: NotificationPrefsState["frequency"],
): NotificationPrefsState["frequency"] => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLocaleLowerCase("tr-TR");

  if (normalized === "anında" || normalized === "aninda") {
    return "Anında";
  }

  if (normalized === "günlük özet" || normalized === "gunluk ozet") {
    return "Günlük özet";
  }

  if (normalized === "haftalık özet" || normalized === "haftalik ozet") {
    return "Haftalık özet";
  }

  return fallback;
};

const toTrimmedString = (value: unknown, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toReminderDaysNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return Math.min(Math.max(value, 0), MAX_NOTIFICATION_REMINDER_DAYS);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) {
      return Math.min(Math.max(parsed, 0), MAX_NOTIFICATION_REMINDER_DAYS);
    }
  }

  return fallback;
};

const toOptionalReminderDaysNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string") {
    const v = value.trim()
    if (!v) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  return undefined
};

const normalizeNotificationReminderDays = (
  value: Partial<NotificationReminderDaysState>,
): NotificationReminderDaysState => ({
  maintenanceDaysBefore: toReminderDaysNumber(
    value.maintenanceDaysBefore,
    defaultNotificationReminderDays.maintenanceDaysBefore,
  ),
  warrantyDaysBefore: toReminderDaysNumber(
    value.warrantyDaysBefore,
    defaultNotificationReminderDays.warrantyDaysBefore,
  ),
  documentDaysBefore: toReminderDaysNumber(
    value.documentDaysBefore,
    defaultNotificationReminderDays.documentDaysBefore,
  ),
  billingDaysBefore: toReminderDaysNumber(
    value.billingDaysBefore,
    defaultNotificationReminderDays.billingDaysBefore,
  ),
});

const getNotificationReminderDays = (
  row: Record<string, unknown> | null | undefined,
): NotificationReminderDaysState =>
  normalizeNotificationReminderDays({
    maintenanceDaysBefore: toOptionalReminderDaysNumber(row?.maintenance_days_before),
    warrantyDaysBefore: toOptionalReminderDaysNumber(row?.warranty_days_before),
    documentDaysBefore: toOptionalReminderDaysNumber(row?.document_days_before),
    billingDaysBefore: toOptionalReminderDaysNumber(row?.billing_days_before),
  });

const toNotificationSettingsRecord = (value: NotificationReminderDaysState) => ({
  maintenance_days_before: value.maintenanceDaysBefore,
  warranty_days_before: value.warrantyDaysBefore,
  document_days_before: value.documentDaysBefore,
  billing_days_before: value.billingDaysBefore,
});

const getMetadataString = (
  metadata: Record<string, unknown> | undefined,
  keys: string[],
  fallback = "",
) => {
  for (const key of keys) {
    const value = toTrimmedString(metadata?.[key]);
    if (value) {
      return value;
    }
  }

  return fallback;
};

const toFullName = (metadata: Record<string, unknown> | undefined, fallbackEmail: string) => {
  const explicitName = metadata?.full_name ?? metadata?.name ?? metadata?.fullName;
  if (typeof explicitName === "string" && explicitName.trim().length > 0) {
    return explicitName.trim();
  }

  const candidate = fallbackEmail.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (candidate && candidate.length > 0) {
    return candidate
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return "";
};

const normalizeProfileValues = (values: ProfileFormValues): ProfileFormValues => ({
  fullName: values.fullName.trim(),
  email: values.email.trim(),
});

const areProfileValuesEqual = (left: ProfileFormValues, right: ProfileFormValues) =>
  JSON.stringify(normalizeProfileValues(left)) === JSON.stringify(normalizeProfileValues(right));

const normalizeOrganizationValues = (
  values: OrganizationSettingsValues,
): OrganizationSettingsValues => {
  const normalizedCurrency = values.defaultCurrency.trim().toUpperCase();

  return {
    name: values.name.trim(),
    industry: values.industry.trim(),
    usageType: values.usageType.trim(),
    teamType: values.teamType.trim(),
    defaultCurrency: ORGANIZATION_CURRENCY_OPTIONS.includes(
      normalizedCurrency as (typeof ORGANIZATION_CURRENCY_OPTIONS)[number],
    )
      ? normalizedCurrency
      : defaultOrganization.defaultCurrency,
    contactEmail: values.contactEmail.trim(),
    note: values.note.trim(),
  };
};

const areOrganizationValuesEqual = (
  left: OrganizationSettingsValues,
  right: OrganizationSettingsValues,
) => JSON.stringify(normalizeOrganizationValues(left)) === JSON.stringify(normalizeOrganizationValues(right));

const getMetadataOrganization = (
  metadata: Record<string, unknown> | undefined,
  fallbackEmail: string,
): OrganizationSettingsValues =>
  normalizeOrganizationValues({
    name: getMetadataString(metadata, ["organization_name", "organizationName"], defaultOrganization.name),
    industry: getMetadataString(metadata, ["organization_industry", "organizationIndustry", "sector"]),
    usageType: getMetadataString(metadata, ["organization_usage_type", "organizationUsageType", "usage_type"]),
    teamType: getMetadataString(
      metadata,
      ["organization_team_type", "organizationTeamType", "team_type", "business_type"],
    ),
    defaultCurrency: getMetadataString(metadata, ["default_currency", "defaultCurrency"], defaultOrganization.defaultCurrency),
    contactEmail: getMetadataString(
      metadata,
      ["organization_contact_email", "organizationContactEmail", "contact_email"],
      fallbackEmail,
    ),
    note: getMetadataString(
      metadata,
      ["organization_note", "organizationNote", "organization_description", "organizationDescription"],
    ),
  });

const toMetadataOrganization = (values: OrganizationSettingsValues) => ({
  organization_name: values.name,
  organizationName: values.name,
  organization_industry: values.industry,
  organizationIndustry: values.industry,
  organization_usage_type: values.usageType,
  organizationUsageType: values.usageType,
  organization_team_type: values.teamType,
  organizationTeamType: values.teamType,
  default_currency: values.defaultCurrency,
  defaultCurrency: values.defaultCurrency,
  organization_contact_email: values.contactEmail,
  organizationContactEmail: values.contactEmail,
  organization_note: values.note,
  organizationNote: values.note,
});

const toMetadataNotificationPrefs = (prefs: NotificationPrefsState) => ({
  maintenance: prefs.maintenance,
  warranty: prefs.warranty,
  document: prefs.document,
  documentExpiry: prefs.documentExpiry,
  document_expiry: prefs.documentExpiry,
  service: prefs.service,
  service_logs: prefs.service,
  service_log: prefs.service,
  payment: prefs.payment,
  system: prefs.system,
  inApp: prefs.inApp,
  in_app: prefs.inApp,
  email: prefs.email,
  frequency: prefs.frequency,
  maintenance_email: prefs.maintenance,
  warranty_email: prefs.warranty,
  document_email: prefs.document,
  document_expiry_email: prefs.documentExpiry,
  service_email: prefs.service,
  subscription_email: prefs.payment,
});

const getMetadataPrefs = (metadata: Record<string, unknown> | undefined): NotificationPrefsState => {
  const source =
    (metadata?.notification_preferences as Record<string, unknown> | undefined) ??
    (metadata?.notificationPreferences as Record<string, unknown> | undefined);

  if (!source) {
    return defaultNotificationPrefs;
  }

  return {
    maintenance: toBoolean(source.maintenance ?? source.maintenance_email, defaultNotificationPrefs.maintenance),
    warranty: toBoolean(source.warranty ?? source.warranty_email, defaultNotificationPrefs.warranty),
    document: toBoolean(
      source.document ?? source.document_missing ?? source.document_email,
      defaultNotificationPrefs.document,
    ),
    documentExpiry: toBoolean(
      source.documentExpiry ?? source.document_expiry ?? source.document_expiry_email ?? source.document,
      defaultNotificationPrefs.documentExpiry,
    ),
    service: toBoolean(
      source.service ?? source.service_logs ?? source.service_log ?? source.service_email,
      defaultNotificationPrefs.service,
    ),
    payment: toBoolean(source.payment ?? source.subscription_email ?? source.billing, defaultNotificationPrefs.payment),
    system: toBoolean(source.system ?? source.general, defaultNotificationPrefs.system),
    inApp: toBoolean(source.inApp ?? source.in_app, defaultNotificationPrefs.inApp),
    email: toBoolean(source.email, defaultNotificationPrefs.email),
    frequency: toNotificationFrequency(source.frequency, defaultNotificationPrefs.frequency),
  };
};

export function SettingsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    plan,
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    subscriptionCount,
    subscriptionLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    refreshPlanState,
  } = usePlanContext();
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const resolvedInitialTab = useMemo(
    () => resolveSettingsTab(searchParams.get("tab")),
    [searchParams],
  );

  const [activeTab, setActiveTab] = useState(resolvedInitialTab);
  const [profile, setProfile] = useState<ProfileFormValues>(defaultProfile);
  const [savedProfile, setSavedProfile] = useState<ProfileFormValues>(defaultProfile);
  const [organization, setOrganization] = useState<OrganizationSettingsValues>(defaultOrganization);
  const [savedOrganization, setSavedOrganization] =
    useState<OrganizationSettingsValues>(defaultOrganization);
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefsState>(defaultNotificationPrefs);
  const [notificationReminderDays, setNotificationReminderDays] =
    useState<NotificationReminderDaysState>(defaultNotificationReminderDays);
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotificationPrefs, setIsSavingNotificationPrefs] = useState(false);
  const [isSavingNotificationReminderDays, setIsSavingNotificationReminderDays] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState("");
  const notificationSaveRequestIdRef = useRef(0);
  const notificationReminderSaveRequestIdRef = useRef(0);
  const metadataRef = useRef<Record<string, unknown>>({});
  const metadataSaveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/settings");
        setIsLoading(false);
        return;
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { data: notificationSettingsData } = await supabase
        .from("notification_settings")
        .select("maintenance_days_before,warranty_days_before,document_days_before,billing_days_before")
        .eq("user_id", user.id)
        .maybeSingle();
      const nextProfile = {
        fullName: toFullName(metadata, user.email ?? ""),
        email: user.email ?? "",
      };
      const nextOrganization = getMetadataOrganization(metadata, user.email ?? "");
      const nextReminderDays = getNotificationReminderDays(
        notificationSettingsData as Record<string, unknown> | null | undefined,
      );

      metadataRef.current = metadata;
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setNotificationPrefs(getMetadataPrefs(metadata));
      setNotificationReminderDays(nextReminderDays);
      setOrganization(nextOrganization);
      setSavedOrganization(nextOrganization);
      setIsLoading(false);
    };

    void load();
  }, [router, supabase.auth]);

  const persistMetadataChanges = useCallback(
    async (changes: Record<string, unknown>, updateErrorMessage: string) => {
      let errorMessage: string | null = null;

      const run = async () => {
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (getUserError || !user) {
          errorMessage = "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.";
          router.replace("/login?next=/settings");
          return;
        }

        const nextMetadata = {
          ...((user.user_metadata ?? {}) as Record<string, unknown>),
          ...metadataRef.current,
          ...changes,
        };
        const { error: updateError } = await supabase.auth.updateUser({
          data: nextMetadata,
        });

        if (updateError) {
          errorMessage = updateErrorMessage;
          return;
        }

        metadataRef.current = nextMetadata;
      };

      const nextQueue = metadataSaveQueueRef.current.then(run, run);
      metadataSaveQueueRef.current = nextQueue.then(
        () => undefined,
        () => undefined,
      );
      await nextQueue;

      return { errorMessage };
    },
    [router, supabase.auth],
  );

  const handleProfileSave = useCallback(async () => {
    const nextProfile = normalizeProfileValues(profile);

    if (nextProfile.fullName.length === 0) {
      setFeedback("Ad soyad alanı boş bırakılamaz.");
      return;
    }

    setIsSavingProfile(true);
    setFeedback("Profil bilgileriniz kaydediliyor...");

    const { errorMessage } = await persistMetadataChanges(
      {
        full_name: nextProfile.fullName,
        fullName: nextProfile.fullName,
        name: nextProfile.fullName,
      },
      "Profil bilgileri kaydedilemedi. Lütfen tekrar deneyin.",
    );

    if (errorMessage) {
      setFeedback(errorMessage);
      setIsSavingProfile(false);
      return;
    }

    setProfile(nextProfile);
    setSavedProfile(nextProfile);
    setFeedback("Profil bilgileriniz kaydedildi.");
    setIsSavingProfile(false);
  }, [persistMetadataChanges, profile]);

  const persistNotificationPrefs = useCallback(
    async (nextPrefs: NotificationPrefsState) => {
      const requestId = notificationSaveRequestIdRef.current + 1;
      notificationSaveRequestIdRef.current = requestId;
      setIsSavingNotificationPrefs(true);
      setFeedback("Bildirim tercihleri kaydediliyor...");

      if (requestId !== notificationSaveRequestIdRef.current) {
        return;
      }

      const nextMetadataPrefs = toMetadataNotificationPrefs(nextPrefs);
      const { errorMessage } = await persistMetadataChanges(
        {
          notification_preferences: nextMetadataPrefs,
          notificationPreferences: nextMetadataPrefs,
        },
        "Bildirim tercihleri kaydedilemedi. Lütfen tekrar deneyin.",
      );

      if (requestId !== notificationSaveRequestIdRef.current) {
        return;
      }

      if (errorMessage) {
        setFeedback(errorMessage);
        setIsSavingNotificationPrefs(false);
        return;
      }

      setFeedback("Bildirim tercihleri güncellendi.");
      setIsSavingNotificationPrefs(false);
    },
    [persistMetadataChanges],
  );

  const handleNotificationPrefsChange = useCallback(
    (nextPrefs: NotificationPrefsState) => {
      setNotificationPrefs(nextPrefs);
      void persistNotificationPrefs(nextPrefs);
    },
    [persistNotificationPrefs],
  );

  const persistNotificationReminderDays = useCallback(
    async (nextReminderDays: NotificationReminderDaysState) => {
      const requestId = notificationReminderSaveRequestIdRef.current + 1;
      notificationReminderSaveRequestIdRef.current = requestId;
      setIsSavingNotificationReminderDays(true);
      setFeedback("Bildirim hatirlatma gunleri kaydediliyor...");

      const normalizedReminderDays = normalizeNotificationReminderDays(nextReminderDays);
      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (requestId !== notificationReminderSaveRequestIdRef.current) {
        return;
      }

      if (getUserError || !user) {
        setFeedback("Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");
        setIsSavingNotificationReminderDays(false);
        router.replace("/login?next=/settings");
        return;
      }

      const { error } = await supabase.from("notification_settings").upsert(
        {
          user_id: user.id,
          ...toNotificationSettingsRecord(normalizedReminderDays),
        },
        { onConflict: "user_id" },
      );

      if (requestId !== notificationReminderSaveRequestIdRef.current) {
        return;
      }

      if (error) {
        setFeedback("Bildirim hatirlatma gunleri kaydedilemedi. Lütfen tekrar deneyin.");
        setIsSavingNotificationReminderDays(false);
        return;
      }

      setNotificationReminderDays(normalizedReminderDays);
      setFeedback("Bildirim hatirlatma gunleri güncellendi.");
      setIsSavingNotificationReminderDays(false);
    },
    [router, supabase],
  );

  const handleNotificationReminderDaysChange = useCallback(
    (nextReminderDays: NotificationReminderDaysState) => {
      setNotificationReminderDays(nextReminderDays);
      void persistNotificationReminderDays(nextReminderDays);
    },
    [persistNotificationReminderDays],
  );

  const handleOrganizationSave = useCallback(async () => {
    const nextOrganization = normalizeOrganizationValues(organization);

    if (nextOrganization.name.length === 0) {
      setFeedback("Organizasyon adı boş bırakılamaz.");
      return;
    }

    setIsSavingOrganization(true);
    setFeedback("Organizasyon ayarları kaydediliyor...");

    const { errorMessage } = await persistMetadataChanges(
      toMetadataOrganization(nextOrganization),
      "Organizasyon ayarları kaydedilemedi. Lütfen tekrar deneyin.",
    );

    if (errorMessage) {
      setFeedback(errorMessage);
      setIsSavingOrganization(false);
      return;
    }

    setOrganization(nextOrganization);
    setSavedOrganization(nextOrganization);
    setFeedback("Organizasyon ayarları kaydedildi.");
    setIsSavingOrganization(false);
  }, [organization, persistMetadataChanges]);

  const usageItems = useMemo(
    () => [
      { id: "assets", label: "Varlıklar", used: assetCount, limit: assetLimit },
      { id: "documents", label: "Belgeler", used: documentCount, limit: documentLimit },
      { id: "subscriptions", label: "Abonelikler", used: subscriptionCount, limit: subscriptionLimit },
      { id: "invoiceUploads", label: "Fatura yükleme", used: invoiceUploadCount, limit: invoiceUploadLimit },
    ],
    [
      assetCount,
      assetLimit,
      documentCount,
      documentLimit,
      invoiceUploadCount,
      invoiceUploadLimit,
      subscriptionCount,
      subscriptionLimit,
    ],
  );

  const startCheckout = useCallback(async () => {
    setFeedback("");
    setIsStartingCheckout(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (res.status === 401) {
        router.replace("/login?next=/settings");
        setIsStartingCheckout(false);
        return;
      }

      if (!res.ok) {
        const responseText = await res.text();
        const checkoutError = responseText || "Stripe checkout başlatılamadı.";
        console.error("Stripe checkout failed:", res.status, checkoutError);
        alert(checkoutError);
        setFeedback(checkoutError);
        setIsStartingCheckout(false);
        return;
      }

      const data = (await res.json().catch(() => null)) as { url?: string } | null;

      if (!data?.url) {
        const missingUrlError = "Checkout URL dönmedi.";
        console.error("Stripe checkout failed:", missingUrlError);
        alert(missingUrlError);
        setFeedback(missingUrlError);
        setIsStartingCheckout(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      const networkError = "Stripe yanıtı okunamadı.";
      console.error("Stripe checkout request failed:", error);
      alert(networkError);
      setFeedback(networkError);
      setIsStartingCheckout(false);
    }
  }, [router]);

  const confirmCheckout = useCallback(async () => {
    if (!checkoutSessionId) {
      return;
    }

    setFeedback("");
    setIsConfirmingCheckout(true);

    try {
      const response = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          session_id: checkoutSessionId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        setFeedback(payload?.error ?? "Premium planı aktifleştirilemedi.");
        setIsConfirmingCheckout(false);
        return;
      }

      await refreshPlanState();
      setFeedback("Premium planınız aktifleştirildi.");
      router.replace("/settings?checkout=confirmed");
    } catch {
      setFeedback("Premium planı aktifleştirilemedi.");
      setIsConfirmingCheckout(false);
      return;
    }

    setIsConfirmingCheckout(false);
  }, [checkoutSessionId, refreshPlanState, router]);

  const isDeleteConfirmationValid =
    deleteConfirmationText.trim().toLocaleUpperCase("tr-TR") === ACCOUNT_DELETE_CONFIRM_KEYWORD;

  const deleteAccount = useCallback(async () => {
    if (!isDeleteConfirmationValid || isDeletingAccount) {
      return;
    }

    setDeleteFeedback("");
    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        const message = payload?.error ?? "Hesap silinemedi. Lütfen tekrar deneyin.";
        setDeleteFeedback(message);
        alert(message);
        setIsDeletingAccount(false);
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        alert(signOutError.message || "Oturum kapatılırken bir sorun oluştu.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Account delete failed:", error);
      const message = "Hesap silme isteği başarısız oldu.";
      setDeleteFeedback(message);
      alert(message);
      setIsDeletingAccount(false);
    }
  }, [isDeleteConfirmationValid, isDeletingAccount, router, supabase.auth]);

  const isProfileSaveDisabled =
    isLoading ||
    isSavingProfile ||
    normalizeProfileValues(profile).fullName.length === 0 ||
    areProfileValuesEqual(profile, savedProfile);
  const isOrganizationSaveDisabled =
    isLoading ||
    isSavingOrganization ||
    normalizeOrganizationValues(organization).name.length === 0 ||
    areOrganizationValuesEqual(organization, savedOrganization);

  return (
    <AppShell title="Ayarlar" badge="Hesap ve Tercihler">
      <section className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Ayarlar</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Profil bilgilerinizi, bildirim tercihlerinizi, plan kullanımınızı ve güvenlik ayarlarınızı tek ekrandan yönetin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {plan !== "premium" ? (
            <Button
              type="button"
              onClick={startCheckout}
              disabled={isStartingCheckout}
              className="bg-gradient-to-r from-indigo-500 to-indigo-400 text-white hover:opacity-95"
            >
              {isStartingCheckout ? "Yönlendiriliyor..." : "Premium'a Geç"}
            </Button>
          ) : null}

          <Button
            asChild
            type="button"
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/">Landing sayfasına dön</Link>
          </Button>

          {checkoutState === "success" && checkoutSessionId ? (
            <Button
              type="button"
              onClick={confirmCheckout}
              disabled={isConfirmingCheckout}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            >
              {isConfirmingCheckout ? "Aktifleştiriliyor..." : "Premium'u Aktif Et"}
            </Button>
          ) : null}
        </div>
        {plan !== "premium" ? (
          <p className="mt-3 text-sm text-slate-300">Premium aylık plan: {PREMIUM_MONTHLY_PRICE_LABEL}</p>
        ) : null}
        {plan !== "premium" ? (
          <p className="mt-3 text-sm text-slate-300">{PAYMENT_TEXT.stripeCollectionNotice}</p>
        ) : null}
      </section>

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      {isLoading ? (
        <section className="premium-card h-36 animate-pulse border-white/10 bg-white/[0.02]" />
      ) : (
        <SettingsTabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="profile" className="outline-none">
            <ProfileForm
              values={profile}
              onChange={setProfile}
              onSave={handleProfileSave}
              isSaving={isSavingProfile}
              isSaveDisabled={isProfileSaveDisabled}
            />
          </TabsContent>

          <TabsContent value="notification-preferences" className="outline-none">
            <NotificationPrefs
              value={notificationPrefs}
              reminderDays={notificationReminderDays}
              onChange={handleNotificationPrefsChange}
              onReminderDaysChange={handleNotificationReminderDaysChange}
              isSaving={isSavingNotificationPrefs || isSavingNotificationReminderDays}
            />
          </TabsContent>

          <TabsContent value="plan-usage" className="outline-none">
            <PlanUsageCard plan={plan} items={usageItems} />
          </TabsContent>

          <TabsContent value="security" className="outline-none">
            <section className="space-y-4">
              <SecuritySection />

              <article
                aria-busy={isDeletingAccount}
                className={`premium-card border border-rose-400/35 bg-rose-500/10 p-5 ${
                  isDeletingAccount ? "opacity-80" : ""
                }`}
              >
                <h3 className="text-lg font-semibold text-white">Hesabı Sil</h3>
                <p className="mt-1 text-sm text-slate-200">
                  Bu işlem geri alınamaz. Tüm verileriniz silinir.
                </p>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs uppercase tracking-[0.16em] text-rose-200/90">
                    Onay için {ACCOUNT_DELETE_CONFIRM_KEYWORD} yazın
                  </span>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(event) => {
                      setDeleteConfirmationText(event.target.value);
                    }}
                    disabled={isDeletingAccount}
                    className={INPUT_CLASS_NAME}
                    placeholder={ACCOUNT_DELETE_CONFIRM_KEYWORD}
                  />
                </label>

                {deleteFeedback ? <p className="mt-3 text-sm text-rose-200">{deleteFeedback}</p> : null}

                <Button
                  type="button"
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={!isDeleteConfirmationValid || isDeletingAccount}
                  className="mt-4"
                >
                  {isDeletingAccount ? "Hesap siliniyor..." : "Hesabı Sil"}
                </Button>
              </article>
            </section>
          </TabsContent>

          <TabsContent value="organization" className="outline-none">
            <section className="premium-card border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Organizasyon</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Çalışma alanınızın adı ve kullanım bilgilerini bu bölümden güncelleyebilirsiniz.
                  </p>
                </div>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-300">
                  Tekli yapı
                </Badge>
              </div>

              <article className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <Building2 className="h-4 w-4 text-slate-200" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{organization.name || defaultOrganization.name}</p>
                    <p className="text-xs text-slate-400">
                      {organization.industry || "Sektör belirtilmedi"} • {organization.teamType || "Tekli yapı"} •{" "}
                      {organization.defaultCurrency}
                    </p>
                    {organization.usageType ? (
                      <p className="mt-1 text-xs text-slate-500">{organization.usageType}</p>
                    ) : null}
                  </div>
                </div>
              </article>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Organizasyon adı</span>
                  <input
                    type="text"
                    value={organization.name}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className={INPUT_CLASS_NAME}
                    placeholder="Örnek: Yılmaz Teknik Hizmetler"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Sektör / kullanım alanı</span>
                  <select
                    value={organization.industry}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        industry: event.target.value,
                      }))
                    }
                    className={SELECT_CLASS_NAME}
                  >
                    <option value="" className="bg-slate-900">
                      Seçin
                    </option>
                    {ORGANIZATION_INDUSTRY_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Kullanım tipi</span>
                  <select
                    value={organization.usageType}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        usageType: event.target.value,
                      }))
                    }
                    className={SELECT_CLASS_NAME}
                  >
                    <option value="" className="bg-slate-900">
                      Seçin
                    </option>
                    {ORGANIZATION_USAGE_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Ekip / işletme tipi</span>
                  <select
                    value={organization.teamType}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        teamType: event.target.value,
                      }))
                    }
                    className={SELECT_CLASS_NAME}
                  >
                    <option value="" className="bg-slate-900">
                      Seçin
                    </option>
                    {ORGANIZATION_TEAM_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Varsayılan para birimi</span>
                  <select
                    value={organization.defaultCurrency}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        defaultCurrency: event.target.value,
                      }))
                    }
                    className={SELECT_CLASS_NAME}
                  >
                    {ORGANIZATION_CURRENCY_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">İletişim e-postası</span>
                  <input
                    type="email"
                    value={organization.contactEmail}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        contactEmail: event.target.value,
                      }))
                    }
                    className={INPUT_CLASS_NAME}
                    placeholder="iletisim@firma.com"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Kısa not</span>
                  <textarea
                    value={organization.note}
                    onChange={(event) =>
                      setOrganization((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="Örnek: Teknik servis ve garanti takibi ağırlıklı kullanılıyor."
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleOrganizationSave}
                  disabled={isOrganizationSaveDisabled}
                  className="bg-white/10 text-white hover:bg-white/15 disabled:bg-white/8"
                >
                  {isSavingOrganization ? "Kaydediliyor..." : "Organizasyonu Kaydet"}
                </Button>
                {isSavingOrganization ? (
                  <p className="text-xs text-sky-200">Organizasyon bilgileri güncelleniyor.</p>
                ) : null}
              </div>
            </section>
          </TabsContent>
        </SettingsTabs>
      )}
    </AppShell>
  );
}
