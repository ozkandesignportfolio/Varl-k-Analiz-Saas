import { SettingsPageContainer } from "@/features/settings/settings-page-container";
import type { SettingsTab } from "@/features/settings/components/SettingsTabs";

type SearchParamValue = string | string[] | undefined;
type SettingsPageSearchParams = Promise<Record<string, SearchParamValue>> | Record<string, SearchParamValue>;

const parseSettingsTab = async (searchParams?: SettingsPageSearchParams): Promise<SettingsTab> => {
  const resolved = (await Promise.resolve(searchParams ?? {})) as Record<string, SearchParamValue>;
  const rawTab = resolved.tab;
  const normalized = (Array.isArray(rawTab) ? rawTab[0] : rawTab ?? "").trim().toLowerCase();

  const mapping: Record<string, SettingsTab> = {
    profile: "profile",
    notifications: "notification-preferences",
    "notification-preferences": "notification-preferences",
    "plan-usage": "plan-usage",
    security: "security",
    organization: "organization",
  };

  return mapping[normalized] ?? "profile";
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: SettingsPageSearchParams;
}) {
  const initialTab = await parseSettingsTab(searchParams);
  return <SettingsPageContainer initialTab={initialTab} />;
}
