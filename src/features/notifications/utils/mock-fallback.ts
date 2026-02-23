const MOCK_FALLBACK_FLAG = process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK;

export const isNotificationMockFallbackEnabled = () => {
  const normalized = MOCK_FALLBACK_FLAG?.trim().toLocaleLowerCase("tr-TR");

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
};
