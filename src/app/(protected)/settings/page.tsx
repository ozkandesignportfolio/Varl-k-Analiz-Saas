import { Suspense } from "react";
import { SettingsPageContainer } from "@/features/settings/settings-page-container";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContainer />
    </Suspense>
  );
}
