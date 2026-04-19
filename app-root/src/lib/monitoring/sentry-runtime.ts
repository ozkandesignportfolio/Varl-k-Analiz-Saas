import { scrubSentryEvent } from "@/lib/monitoring/sentry-scrubber";
import { BuildEnv, isProductionNodeEnv } from "@/lib/env/build-env";
import { PublicEnv } from "@/lib/env/public-env";

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSY_VALUES = new Set(["0", "false", "no", "off"]);

const asTrimmed = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const parseBooleanEnv = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }

  if (FALSY_VALUES.has(normalized)) {
    return false;
  }

  return undefined;
};

const parseSampleRate = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
};

const getDsnFromEnv = () =>
  asTrimmed(PublicEnv.NEXT_PUBLIC_SENTRY_DSN);

const sanitizeBeforeSend = <T>(event: T) => scrubSentryEvent(event);

type SentryEnablementState = {
  dsn: string | undefined;
  explicitFlag: boolean | undefined;
  enabled: boolean;
  invalidFlagEnvNames: string[];
};

const resolveSentryEnablementState = (): SentryEnablementState => {
  const dsn = getDsnFromEnv();

  const publicSentryEnabledRaw = asTrimmed(PublicEnv.NEXT_PUBLIC_SENTRY_ENABLED);
  const publicSentryEnabled = parseBooleanEnv(publicSentryEnabledRaw);

  const explicitFlag = publicSentryEnabled;
  const enabled =
    Boolean(dsn) &&
    (explicitFlag !== undefined ? explicitFlag : isProductionNodeEnv());

  const invalidFlagEnvNames: string[] = [];
  if (publicSentryEnabledRaw && publicSentryEnabled === undefined) {
    invalidFlagEnvNames.push("NEXT_PUBLIC_SENTRY_ENABLED");
  }

  return {
    dsn,
    explicitFlag,
    enabled,
    invalidFlagEnvNames,
  };
};

const maybeWarnAboutSentryConfig = (state: SentryEnablementState) => {
  if (!isProductionNodeEnv()) {
    return;
  }

  const issues: string[] = [];
  if (!state.enabled) {
    issues.push("Sentry events are disabled.");
  }
  if (!state.dsn) {
    issues.push("DSN is empty (`NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`).");
  }
  if (state.explicitFlag === false) {
    issues.push("Sentry is explicitly disabled (`SENTRY_ENABLED` or `NEXT_PUBLIC_SENTRY_ENABLED` is false).");
  }
  if (state.invalidFlagEnvNames.length > 0) {
    issues.push(
      `Invalid boolean value in ${state.invalidFlagEnvNames.join(", ")} (use 1,true,yes,on or 0,false,no,off).`,
    );
  }

  if (issues.length === 0) {
    return;
  }

  const warningState = globalThis as typeof globalThis & {
    __assetly_sentry_config_warning_logged__?: boolean;
  };
  if (warningState.__assetly_sentry_config_warning_logged__) {
    return;
  }
  warningState.__assetly_sentry_config_warning_logged__ = true;

  console.warn(`[monitoring] Sentry configuration warning (production): ${issues.join(" ")}`);
};

const getResolvedSentryEnablement = () => {
  const state = resolveSentryEnablementState();
  maybeWarnAboutSentryConfig(state);
  return state;
};

export const getSentryEnabled = () => {
  return getResolvedSentryEnablement().enabled;
};

export const getSentryInitOptions = () => {
  const enablement = getResolvedSentryEnablement();

  return {
    dsn: enablement.dsn,
    enabled: enablement.enabled,
    sendDefaultPii: false,
    environment:
      asTrimmed(PublicEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
      (isProductionNodeEnv() ? "production" : BuildEnv.NODE_ENV || "development"),
    release: undefined,
    tracesSampleRate: parseSampleRate(
      asTrimmed(PublicEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
      isProductionNodeEnv() ? 0.1 : 0,
    ),
    beforeSend: sanitizeBeforeSend,
  };
};

export const normalizeUnknownError = (value: unknown) => {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  return new Error("Unknown non-error rejection");
};
