import type { PostgrestError } from "@supabase/supabase-js";

export const billingTables = ["billing_subscriptions", "billing_invoices"] as const;
export type BillingTableName = (typeof billingTables)[number];

export type BillingSchemaCheckSource = "startup" | "request" | "runtime-error";

export type BillingSchemaState = {
  enabled: boolean;
  missingTables: BillingTableName[];
  checkedAt: string;
  source: BillingSchemaCheckSource;
};

export type BillingFeatureDisabledErrorBody = {
  error: string;
  code: "BILLING_FEATURE_DISABLED";
  feature: "billing";
  missingTables: BillingTableName[];
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204"]);
const MISSING_TABLE_PATTERNS = ["schema cache", "does not exist", "relation", "unknown relation"];

let cachedSchemaState: BillingSchemaState | null = null;

const isBillingTable = (value: string): value is BillingTableName =>
  (billingTables as readonly string[]).includes(value);

const normalizeMessage = (value: unknown) => String(value ?? "").toLowerCase();

const getErrorLike = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as { code?: unknown; message?: unknown }) : null;

const resolveMissingTables = (tableNames: readonly string[]): BillingTableName[] => {
  const found = new Set(tableNames.map((tableName) => tableName.toLowerCase()));
  return billingTables.filter((tableName) => !found.has(tableName));
};

export const buildBillingSchemaState = (
  tableNames: readonly string[],
  source: BillingSchemaCheckSource,
): BillingSchemaState => {
  const missingTables = resolveMissingTables(tableNames);
  return {
    enabled: missingTables.length === 0,
    missingTables,
    checkedAt: new Date().toISOString(),
    source,
  };
};

export function getCachedBillingSchemaState(): BillingSchemaState | null {
  return cachedSchemaState;
}

export function setCachedBillingSchemaState(schemaState: BillingSchemaState) {
  cachedSchemaState = schemaState;
}

export function markBillingTablesMissing(tables: readonly BillingTableName[]) {
  if (tables.length === 0) {
    return;
  }

  const dedupedMissingTables = Array.from(
    new Set([...(cachedSchemaState?.missingTables ?? []), ...tables]),
  ).filter(isBillingTable);

  cachedSchemaState = {
    enabled: false,
    missingTables: dedupedMissingTables,
    checkedAt: new Date().toISOString(),
    source: "runtime-error",
  };
}

export function extractBillingMissingTables(
  error: unknown,
  fallbackTables: readonly BillingTableName[] = billingTables,
): BillingTableName[] {
  const message = normalizeMessage(getErrorLike(error)?.message ?? error);
  const parsedTables = billingTables.filter(
    (tableName) =>
      message.includes(tableName) ||
      message.includes(`public.${tableName}`) ||
      message.includes(`"${tableName}"`) ||
      message.includes(`'${tableName}'`),
  );

  return parsedTables.length > 0 ? parsedTables : [...fallbackTables];
}

export function isBillingMissingTableError(
  error: unknown,
  billingTableHints: readonly BillingTableName[] = billingTables,
): boolean {
  const errorLike = getErrorLike(error);
  const code = typeof errorLike?.code === "string" ? errorLike.code : "";
  const message = normalizeMessage(errorLike?.message ?? error);
  const hasMissingTableCode = MISSING_TABLE_CODES.has(code);
  const hasMissingTablePattern = MISSING_TABLE_PATTERNS.some((pattern) => message.includes(pattern));
  const mentionsBillingTable = billingTableHints.some(
    (tableName) => message.includes(tableName) || message.includes(`public.${tableName}`),
  );

  if (mentionsBillingTable && hasMissingTablePattern) {
    return true;
  }

  if (hasMissingTableCode && (mentionsBillingTable || message.includes("billing_"))) {
    return true;
  }

  return hasMissingTableCode && billingTableHints.length > 0;
}

export function toBillingFeatureDisabledErrorBody(
  missingTables: readonly BillingTableName[],
): BillingFeatureDisabledErrorBody {
  const listText = missingTables.join(", ");
  return {
    error: `Billing feature is temporarily disabled because required tables are missing: ${listText}.`,
    code: "BILLING_FEATURE_DISABLED",
    feature: "billing",
    missingTables: [...missingTables],
  };
}

export function createBillingMissingTablePostgrestError(
  missingTables: readonly BillingTableName[],
): PostgrestError {
  const body = toBillingFeatureDisabledErrorBody(missingTables);
  return {
    name: "PostgrestError",
    message: body.error,
    details: `Missing tables: ${body.missingTables.join(", ")}`,
    hint: "Apply billing migrations and refresh Supabase schema cache.",
    code: "42P01",
  };
}