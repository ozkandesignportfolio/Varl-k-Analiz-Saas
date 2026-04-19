import "server-only";

import { createClient as createSupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import {
  billingTables,
  buildBillingSchemaState,
  getCachedBillingSchemaState,
  setCachedBillingSchemaState,
  type BillingSchemaCheckSource,
  type BillingSchemaState,
} from "@/lib/billing/schema-guard";
import { readServerEnvOptional } from "@/lib/env/server-env";
import type { DbClient } from "@/lib/repos/_shared";
import type { Database } from "@/types/database";

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

let startupSchemaCheckPromise: Promise<BillingSchemaState> | null = null;

const asCatalogClient = (client: DbClient) => client as unknown as CatalogSchemaClient;

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

const queryBillingSchemaState = async (
  client: DbClient,
  source: BillingSchemaCheckSource,
): Promise<BillingSchemaState> => {
  const infoSchemaResult = await readFromInformationSchema(client);
  if (!infoSchemaResult.error) {
    return buildBillingSchemaState(infoSchemaResult.tableNames, source);
  }

  const pgCatalogResult = await readFromPgCatalog(client);
  if (!pgCatalogResult.error) {
    return buildBillingSchemaState(pgCatalogResult.tableNames, source);
  }

  return buildBillingSchemaState(billingTables, source);
};

const createStartupClient = (): DbClient | null => {
  const supabaseUrl = readServerEnvOptional("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readServerEnvOptional("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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
      setCachedBillingSchemaState(schemaState);
      return schemaState;
    })
    .catch(() => buildBillingSchemaState(billingTables, "startup"));
};

runStartupSchemaCheck();

export async function getBillingSchemaState(client: DbClient): Promise<BillingSchemaState> {
  if (startupSchemaCheckPromise) {
    const startupState = await startupSchemaCheckPromise;
    if (!startupState.enabled) {
      setCachedBillingSchemaState(startupState);
      return startupState;
    }
  }

  const cachedSchemaState = getCachedBillingSchemaState();
  if (cachedSchemaState) {
    return cachedSchemaState;
  }

  const requestState = await queryBillingSchemaState(client, "request");
  setCachedBillingSchemaState(requestState);
  return requestState;
}