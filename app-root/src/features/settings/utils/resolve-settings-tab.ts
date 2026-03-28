import type { SettingsTab } from "@/features/settings/components/SettingsTabs";

const SETTINGS_TAB_MAPPING: Record<string, SettingsTab> = {
  profile: "profile",
  notifications: "notification-preferences",
  "notification-preferences": "notification-preferences",
  "plan-usage": "plan-usage",
  security: "security",
  organization: "organization",
};

export const resolveSettingsTab = (rawTab: string | null | undefined): SettingsTab => {
  const normalized = (rawTab ?? "").trim().toLocaleLowerCase("tr-TR");
  return SETTINGS_TAB_MAPPING[normalized] ?? "profile";
};
