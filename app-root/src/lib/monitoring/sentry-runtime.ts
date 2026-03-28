import { scrubSentryEvent } from "@/lib/monitoring/sentry-scrubber";

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
  asTrimmed(process.env.NEXT_PUBLIC_SENTRY_DSN) ?? asTrimmed(process.env.SENTRY_DSN);

const sanitizeBeforeSend = <T>(event: T) => scrubSentryEvent(event);

type SentryEnablementState = {
  dsn: string | undefined;
  explicitFlag: boolean | undefined;
  enabled: boolean;
  invalidFlagEnvNames: string[];
};

const resolveSentryEnablementState = (): SentryEnablementState => {
  const dsn = getDsnFromEnv();

  const sentryEnabledRaw = asTrimmed(process.env.SENTRY_ENABLED);
  const publicSentryEnabledRaw = asTrimmed(process.env.NEXT_PUBLIC_SENTRY_ENABLED);
  const sentryEnabled = parseBooleanEnv(sentryEnabledRaw);
  const publicSentryEnabled = parseBooleanEnv(publicSentryEnabledRaw);

  const explicitFlag = sentryEnabled ?? publicSentryEnabled;
  const enabled =
    Boolean(dsn) &&
    (explicitFlag !== undefined ? explicitFlag : process.env.NODE_ENV === "production");

  const invalidFlagEnvNames: string[] = [];
  if (sentryEnabledRaw && sentryEnabled === undefined) {
    invalidFlagEnvNames.push("SENTRY_ENABLED");
  }
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
  if (process.env.NODE_ENV !== "production") {
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
      asTrimmed(process.env.SENTRY_ENVIRONMENT) ??
      asTrimmed(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
      process.env.NODE_ENV,
    release: asTrimmed(process.env.SENTRY_RELEASE),
    tracesSampleRate: parseSampleRate(
      asTrimmed(process.env.SENTRY_TRACES_SAMPLE_RATE) ??
        asTrimmed(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
      process.env.NODE_ENV === "production" ? 0.1 : 0,
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
