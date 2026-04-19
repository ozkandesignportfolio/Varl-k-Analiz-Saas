import { Runtime } from "@/lib/env/runtime";

export const UNKNOWN_DEVICE_FINGERPRINT = "unknown-device";

const ROUTE_TAG = "[auth.signup]";

export const isUnknownDeviceFingerprint = (value?: string | null) =>
  !value || value.trim().toLowerCase() === UNKNOWN_DEVICE_FINGERPRINT;

export const createDeviceFingerprint = async (): Promise<string> => {
  if (!Runtime.isClient() || typeof navigator === "undefined") {
    console.warn(`${ROUTE_TAG} Device fingerprint requested outside the browser. Falling back to unknown-device.`);
    return UNKNOWN_DEVICE_FINGERPRINT;
  }

  if (!window.crypto?.subtle) {
    console.warn(`${ROUTE_TAG} Web Crypto is unavailable. Falling back to unknown-device.`);
    return UNKNOWN_DEVICE_FINGERPRINT;
  }

  try {
    const fingerprintParts = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      String(window.screen?.width ?? ""),
      String(window.screen?.height ?? ""),
      String(window.devicePixelRatio ?? ""),
      String(navigator.hardwareConcurrency ?? ""),
    ];

    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(fingerprintParts.join("|")),
    );

    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.warn(`${ROUTE_TAG} Device fingerprint generation failed. Falling back to unknown-device.`, error);
    return UNKNOWN_DEVICE_FINGERPRINT;
  }
};
