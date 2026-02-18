import type { PostgrestError } from "@supabase/supabase-js";

type QueryErrorLike = Pick<PostgrestError, "code" | "message">;

type SafeQueryError = {
  code: string | null;
  message: string;
};

export type ExpensesTableWarning = {
  level: "warning";
  code: "EXPENSES_TABLE_MISSING";
  table: "public.expenses";
  operation: "read" | "write";
  source: "schema_cache" | "database";
  context: string;
  originalCode: string | null;
  message: string;
};

export type SafeExpensesReadResult<T> = {
  data: T[];
  error: SafeQueryError | null;
  warning: ExpensesTableWarning | null;
};

export type SafeExpensesWriteResult = {
  error: SafeQueryError | null;
  warning: ExpensesTableWarning | null;
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

const normalizeMessage = (message: string | null | undefined) => message?.toLowerCase() ?? "";

const isMissingExpensesTableMessage = (message: string) =>
  message.includes("public.expenses") ||
  message.includes("relation \"expenses\" does not exist") ||
  message.includes("table 'expenses'") ||
  (message.includes("expenses") && message.includes("schema cache")) ||
  message.includes("not found in schema cache");

const toSafeQueryError = (error: unknown): SafeQueryError => {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    return {
      code,
      message: message || "Beklenmeyen gider sorgu hatasi.",
    };
  }

  if (error instanceof Error) {
    return { code: null, message: error.message || "Beklenmeyen gider sorgu hatasi." };
  }

  return { code: null, message: "Beklenmeyen gider sorgu hatasi." };
};

const toMissingExpensesWarning = (
  error: unknown,
  operation: ExpensesTableWarning["operation"],
  context: string,
): ExpensesTableWarning | null => {
  const normalizedError = toSafeQueryError(error);
  const normalizedMessage = normalizeMessage(normalizedError.message);
  const hasMissingTableCode = normalizedError.code ? MISSING_TABLE_CODES.has(normalizedError.code) : false;

  if (!hasMissingTableCode && !isMissingExpensesTableMessage(normalizedMessage)) {
    return null;
  }

  return {
    level: "warning",
    code: "EXPENSES_TABLE_MISSING",
    table: "public.expenses",
    operation,
    source: normalizedMessage.includes("schema cache") ? "schema_cache" : "database",
    context,
    originalCode: normalizedError.code,
    message: normalizedError.message,
  };
};

export async function safeExpensesReadQuery<T>(
  query: Promise<{ data: T[] | null; error: QueryErrorLike | null }>,
  context: string,
): Promise<SafeExpensesReadResult<T>> {
  try {
    const { data, error } = await query;
    if (!error) {
      return { data: data ?? [], error: null, warning: null };
    }

    const warning = toMissingExpensesWarning(error, "read", context);
    if (warning) {
      return { data: [], error: null, warning };
    }

    return { data: data ?? [], error: toSafeQueryError(error), warning: null };
  } catch (error) {
    const warning = toMissingExpensesWarning(error, "read", context);
    if (warning) {
      return { data: [], error: null, warning };
    }

    return { data: [], error: toSafeQueryError(error), warning: null };
  }
}

export async function safeExpensesWriteQuery(
  query: Promise<{ error: QueryErrorLike | null }>,
  context: string,
): Promise<SafeExpensesWriteResult> {
  try {
    const { error } = await query;
    if (!error) {
      return { error: null, warning: null };
    }

    const warning = toMissingExpensesWarning(error, "write", context);
    if (warning) {
      return { error: null, warning };
    }

    return { error: toSafeQueryError(error), warning: null };
  } catch (error) {
    const warning = toMissingExpensesWarning(error, "write", context);
    if (warning) {
      return { error: null, warning };
    }

    return { error: toSafeQueryError(error), warning: null };
  }
}
