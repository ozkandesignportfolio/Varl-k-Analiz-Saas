import "server-only";

import { createClient as createSupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import type { DbClient } from "@/lib/repos/_shared";
import type { Database } from "@/types/database";

export const billingTables = ["billing_subscriptions", "billing_invoices"] as const;
export type BillingTableName = (typeof billingTables)[number];

type BillingSchemaCheckSource = "startup" | "request" | "runtime-error";

type CatalogCheckResult = {
  tableNames: string[];
  error: PostgrestError | null;
};

type CatalogRow = {
  table_name?: string | null;
  tablename?: string | null;
};

type CatalogSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          in: (column: string, values: readonly string[]) => Promise<{
            data: CatalogRow[] | null;
            error: PostgrestError | null;
          }>;
        };
      };
    };
  };
};

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
let startupSchemaCheckPromise: Promise<BillingSchemaState> | null = null;

const asCatalogClient = (client: DbClient) => client as unknown as CatalogSchemaClient;

const isBillingTable = (value: string): value is BillingTableName =>
  (billingTables as readonly string[]).includes(value);

const normalizeMessage = (value: unknown) => String(value ?? "").toLowerCase();

const getErrorLike = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as { code?: unknown; message?: unknown }) : null;

const extractTableNames = (rows: CatalogRow[] | null) =>
  (rows ?? [])
    .map((row) => {
      const tableName = typeof row.table_name === "string" ? row.table_name : null;
      const pgTableName = typeof row.tablename === "string" ? row.tablename : null;
      return (tableName ?? pgTableName ?? "").trim().toLowerCase();
    })
    .filter((value) => value.length > 0);

const readFromInformationSchema = async (client: DbClient): Promise<CatalogCheckResult> => {
  const { data, error } = await asCatalogClient(client)
    .schema("information_schema")
    .from("tables")
    .select("table_name")
    .eq("table_schema", "public")
    .in("table_name", billingTables);

  return {
    tableNames: extractTableNames(data),
    error,
  };
};

const readFromPgCatalog = async (client: DbClient): Promise<CatalogCheckResult> => {
  const { data, error } = await asCatalogClient(client)
    .schema("pg_catalog")
    .from("pg_tables")
    .select("tablename")
    .eq("schemaname", "public")
    .in("tablename", billingTables);

  return {
    tableNames: extractTableNames(data),
    error,
  };
};

const resolveMissingTables = (tableNames: readonly string[]): BillingTableName[] => {
  const found = new Set(tableNames.map((tableName) => tableName.toLowerCase()));
  return billingTables.filter((tableName) => !found.has(tableName));
};

const buildSchemaState = (
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

const queryBillingSchemaState = async (
  client: DbClient,
  source: BillingSchemaCheckSource,
): Promise<BillingSchemaState> => {
  const infoSchemaResult = await readFromInformationSchema(client);
  if (!infoSchemaResult.error) {
    return buildSchemaState(infoSchemaResult.tableNames, source);
  }

  const pgCatalogResult = await readFromPgCatalog(client);
  if (!pgCatalogResult.error) {
    return buildSchemaState(pgCatalogResult.tableNames, source);
  }

  return buildSchemaState(billingTables, source);
};

const createStartupClient = (): DbClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const runStartupSchemaCheck = () => {
  if (startupSchemaCheckPromise) {
    return;
  }

  const startupClient = createStartupClient();
  if (!startupClient) {
    return;
  }

  startupSchemaCheckPromise = queryBillingSchemaState(startupClient, "startup")
    .then((schemaState) => {
      cachedSchemaState = schemaState;
      return schemaState;
    })
    .catch(() => buildSchemaState(billingTables, "startup"));
};

runStartupSchemaCheck();

export async function getBillingSchemaState(client: DbClient): Promise<BillingSchemaState> {
  if (startupSchemaCheckPromise) {
    const startupState = await startupSchemaCheckPromise;
    if (!startupState.enabled) {
      cachedSchemaState = startupState;
      return startupState;
    }
  }

  if (cachedSchemaState) {
    return cachedSchemaState;
  }

  const requestState = await queryBillingSchemaState(client, "request");
  cachedSchemaState = requestState;
  return requestState;
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
