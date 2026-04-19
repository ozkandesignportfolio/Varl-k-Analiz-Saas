import { isProductionNodeEnv } from "@/lib/env/build-env";
import { PublicEnv } from "@/lib/env/public-env";

const MOCK_FALLBACK_FLAG = PublicEnv.NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK;

export const isNotificationMockFallbackEnabled = () => {
  const normalized = MOCK_FALLBACK_FLAG?.trim().toLocaleLowerCase("tr-TR");

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return !isProductionNodeEnv();
};
