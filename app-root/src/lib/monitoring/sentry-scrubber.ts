const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|token|password|secret|api[-_]?key|session|email|phone|credit|card|iban)/i;
const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 40;
const MAX_STRING_LENGTH = 800;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sanitizeString = (value: string) =>
  value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;

export const sanitizeSentryData = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) {
    return TRUNCATED;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeSentryData(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = REDACTED;
        continue;
      }

      sanitized[key] = sanitizeSentryData(nestedValue, depth + 1);
    }
    return sanitized;
  }

  return value;
};

export const scrubSentryEvent = <T>(event: T): T => sanitizeSentryData(event) as T;
