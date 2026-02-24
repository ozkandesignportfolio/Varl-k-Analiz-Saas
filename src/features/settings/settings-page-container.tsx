"use client";

import { Building2 } from "lucide-react";
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
} from "@/features/settings/components/NotificationPrefs";
import { PlanUsageCard } from "@/features/settings/components/PlanUsageCard";
import { ProfileForm, type ProfileFormValues } from "@/features/settings/components/ProfileForm";
import { SecuritySection } from "@/features/settings/components/SecuritySection";
import { SettingsTabs } from "@/features/settings/components/SettingsTabs";
import { resolveSettingsTab } from "@/features/settings/utils/resolve-settings-tab";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

const defaultProfile: ProfileFormValues = {
  fullName: "",
  email: "",
};

const defaultNotificationPrefs: NotificationPrefsState = {
  maintenance: true,
  warranty: true,
  document: true,
  payment: true,
  system: true,
  inApp: true,
  email: false,
  frequency: "Anında" as NotificationPrefsState["frequency"],
};

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const toNotificationFrequency = (
  value: unknown,
  fallback: NotificationPrefsState["frequency"],
): NotificationPrefsState["frequency"] => {
  if (typeof value !== "string") {
    return fallback;
  }

  return value as NotificationPrefsState["frequency"];
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

const toMetadataNotificationPrefs = (prefs: NotificationPrefsState) => ({
  maintenance: prefs.maintenance,
  warranty: prefs.warranty,
  document: prefs.document,
  payment: prefs.payment,
  system: prefs.system,
  inApp: prefs.inApp,
  email: prefs.email,
  frequency: prefs.frequency,
  maintenance_email: prefs.maintenance,
  warranty_email: prefs.warranty,
  document_email: prefs.document,
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
    document: toBoolean(source.document ?? source.document_email, defaultNotificationPrefs.document),
    payment: toBoolean(source.payment ?? source.subscription_email, defaultNotificationPrefs.payment),
    system: toBoolean(source.system, defaultNotificationPrefs.system),
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
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefsState>(defaultNotificationPrefs);
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingNotificationPrefs, setIsSavingNotificationPrefs] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
  const [organizationName, setOrganizationName] = useState("Kişisel Çalışma Alanı");
  const notificationSaveRequestIdRef = useRef(0);

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
      setProfile({
        fullName: toFullName(metadata, user.email ?? ""),
        email: user.email ?? "",
      });
      setNotificationPrefs(getMetadataPrefs(metadata));
      setOrganizationName(
        typeof metadata.organization_name === "string" && metadata.organization_name.trim().length > 0
          ? metadata.organization_name
          : "Kişisel Çalışma Alanı",
      );
      setIsLoading(false);
    };

    void load();
  }, [router, supabase.auth]);

  const persistNotificationPrefs = useCallback(
    async (nextPrefs: NotificationPrefsState) => {
      const requestId = notificationSaveRequestIdRef.current + 1;
      notificationSaveRequestIdRef.current = requestId;
      setIsSavingNotificationPrefs(true);
      setFeedback("Bildirim tercihleri kaydediliyor...");

      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (requestId !== notificationSaveRequestIdRef.current) {
        return;
      }

      if (getUserError || !user) {
        setFeedback("Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");
        setIsSavingNotificationPrefs(false);
        router.replace("/login?next=/settings");
        return;
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const nextMetadataPrefs = toMetadataNotificationPrefs(nextPrefs);
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...metadata,
          notification_preferences: nextMetadataPrefs,
          notificationPreferences: nextMetadataPrefs,
        },
      });

      if (requestId !== notificationSaveRequestIdRef.current) {
        return;
      }

      if (updateError) {
        setFeedback("Bildirim tercihleri kaydedilemedi. Lütfen tekrar deneyin.");
        setIsSavingNotificationPrefs(false);
        return;
      }

      setFeedback("Bildirim tercihleri güncellendi.");
      setIsSavingNotificationPrefs(false);
    },
    [router, supabase.auth],
  );

  const handleNotificationPrefsChange = useCallback(
    (nextPrefs: NotificationPrefsState) => {
      setNotificationPrefs(nextPrefs);
      void persistNotificationPrefs(nextPrefs);
    },
    [persistNotificationPrefs],
  );

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
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !payload?.url) {
        setFeedback(payload?.error ?? "Stripe checkout başlatılamadı.");
        setIsStartingCheckout(false);
        return;
      }

      window.location.assign(payload.url);
    } catch {
      setFeedback("Stripe checkout başlatılamadı.");
      setIsStartingCheckout(false);
    }
  }, []);

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
              className="bg-white/10 text-white hover:bg-white/15"
            >
              {isStartingCheckout ? "Yönlendiriliyor..." : "Premium’a Geç"}
            </Button>
          ) : null}

          {checkoutState === "success" && checkoutSessionId ? (
            <Button
              type="button"
              onClick={confirmCheckout}
              disabled={isConfirmingCheckout}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            >
              {isConfirmingCheckout ? "Aktifleştiriliyor..." : "Premium’u Aktif Et"}
            </Button>
          ) : null}
        </div>
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
            <ProfileForm values={profile} onChange={setProfile} isSaveDisabled />
          </TabsContent>

          <TabsContent value="notification-preferences" className="outline-none">
            <NotificationPrefs
              value={notificationPrefs}
              onChange={handleNotificationPrefsChange}
              isSaving={isSavingNotificationPrefs}
            />
          </TabsContent>

          <TabsContent value="plan-usage" className="outline-none">
            <PlanUsageCard plan={plan} items={usageItems} />
          </TabsContent>

          <TabsContent value="security" className="outline-none">
            <SecuritySection />
          </TabsContent>

          <TabsContent value="organization" className="outline-none">
            <section className="premium-card border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Organizasyon</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Ekip ve çalışma alanı bilgilerini bu bölümden yönetebilirsiniz.
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
                    <p className="text-sm font-semibold text-white">{organizationName}</p>
                    <p className="text-xs text-slate-400">Bu hesap tek organizasyonlu çalışma düzeninde çalışıyor.</p>
                  </div>
                </div>
              </article>
            </section>
          </TabsContent>
        </SettingsTabs>
      )}
    </AppShell>
  );
}
