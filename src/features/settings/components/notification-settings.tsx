"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationPreferences = {
  maintenanceEmail: boolean;
  warrantyEmail: boolean;
  subscriptionEmail: boolean;
};

type LooseError = {
  message: string;
};

type LooseRow = Record<string, unknown>;

type LooseSelectQuery = {
  eq: (column: string, value: string) => {
    maybeSingle: () => Promise<{ data: LooseRow | null; error: LooseError | null }>;
  };
};

type LooseTableQuery = {
  select: (columns: string) => LooseSelectQuery;
  upsert: (
    values: LooseRow,
    options: { onConflict: string },
  ) => Promise<{ error: LooseError | null }>;
};

type LooseSupabaseClient = {
  from: (table: string) => LooseTableQuery;
};

const defaultPreferences: NotificationPreferences = {
  maintenanceEmail: true,
  warrantyEmail: true,
  subscriptionEmail: true,
};

const inputClassName =
  "h-4 w-4 rounded border-white/20 bg-white/5 text-sky-400 focus:ring-sky-400";

const isMissingUserSettingsTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("user_settings") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  );
};

const toPreferences = (value: unknown): NotificationPreferences => {
  if (!value || typeof value !== "object") return defaultPreferences;

  const source = value as Record<string, unknown>;
  const maintenance = source.maintenance_email ?? source.maintenanceEmail;
  const warranty = source.warranty_email ?? source.warrantyEmail;
  const subscription = source.subscription_email ?? source.subscriptionEmail;

  return {
    maintenanceEmail: typeof maintenance === "boolean" ? maintenance : defaultPreferences.maintenanceEmail,
    warrantyEmail: typeof warranty === "boolean" ? warranty : defaultPreferences.warrantyEmail,
    subscriptionEmail:
      typeof subscription === "boolean" ? subscription : defaultPreferences.subscriptionEmail,
  };
};

const toStoragePayload = (preferences: NotificationPreferences) => ({
  maintenance_email: preferences.maintenanceEmail,
  warranty_email: preferences.warrantyEmail,
  subscription_email: preferences.subscriptionEmail,
});

export function NotificationSettings() {
  const supabase = useMemo(() => createClient(), []);
  const settingsClient = useMemo(
    () => supabase as unknown as LooseSupabaseClient,
    [supabase],
  );

  const [userId, setUserId] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFeedback("Session not found.");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);

      const settingsRes = await settingsClient
        .from("user_settings")
        .select("maintenance_email,warranty_email,subscription_email,preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!settingsRes.error && settingsRes.data) {
        setPreferences(
          toPreferences(
            settingsRes.data.preferences && typeof settingsRes.data.preferences === "object"
              ? settingsRes.data.preferences
              : settingsRes.data,
          ),
        );
      } else {
        const metadataPrefs = toPreferences(
          (user.user_metadata as Record<string, unknown> | undefined)?.notification_preferences,
        );
        setPreferences(metadataPrefs);

        if (settingsRes.error && !isMissingUserSettingsTableError(settingsRes.error.message)) {
          setFeedback(settingsRes.error.message);
        }
      }

      setIsLoading(false);
    };

    void load();
  }, [settingsClient, supabase]);

  const onSave = async () => {
    if (!userId) {
      setFeedback("User info is missing.");
      return;
    }

    setIsSaving(true);
    setFeedback("");
    const payload = toStoragePayload(preferences);

    const tableUpsert = await settingsClient.from("user_settings").upsert(
      {
        user_id: userId,
        ...payload,
        preferences: payload,
      },
      { onConflict: "user_id" },
    );

    if (!tableUpsert.error) {
      setFeedback("Notification preferences saved.");
      setIsSaving(false);
      return;
    }

    if (!isMissingUserSettingsTableError(tableUpsert.error.message)) {
      setFeedback(tableUpsert.error.message);
      setIsSaving(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        notification_preferences: payload,
      },
    });

    if (metadataError) {
      setFeedback(metadataError.message);
      setIsSaving(false);
      return;
    }

    setFeedback("Notification preferences saved.");
    setIsSaving(false);
  };

  return (
    <section className="premium-card p-5">
      <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
      <p className="mt-1 text-sm text-slate-300">Choose which email alerts you want to receive.</p>

      {isLoading ? <p className="mt-4 text-sm text-slate-300">Loading...</p> : null}

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className={inputClassName}
            checked={preferences.maintenanceEmail}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, maintenanceEmail: event.target.checked }))
            }
          />
          Maintenance email
        </label>

        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className={inputClassName}
            checked={preferences.warrantyEmail}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, warrantyEmail: event.target.checked }))
            }
          />
          Warranty email
        </label>

        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className={inputClassName}
            checked={preferences.subscriptionEmail}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, subscriptionEmail: event.target.checked }))
            }
          />
          Subscription email
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isLoading || isSaving}
          className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        {feedback ? <p className="text-xs text-slate-300">{feedback}</p> : null}
      </div>
    </section>
  );
}
