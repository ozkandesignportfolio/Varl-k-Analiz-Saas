import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type DeleteCandidate = {
  column: "user_id" | "owner_id" | "email";
  value: string | null;
};

type DeleteTarget = {
  table: string;
  candidates: DeleteCandidate[];
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

const isMissingTableError = (error: QueryError) => {
  const code = error.code ?? "";
  if (MISSING_TABLE_CODES.has(code)) {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  return message.includes("does not exist") && message.includes("table");
};

const isMissingColumnError = (error: QueryError, columnName: string) => {
  const code = error.code ?? "";
  if (MISSING_COLUMN_CODES.has(code)) {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  return message.includes("column") && message.includes(columnName.toLowerCase()) && message.includes("does not exist");
};

const deleteByColumn = async (adminClient: SupabaseClient, table: string, column: string, value: string) => {
  const tableClient = adminClient as unknown as {
    from: (tableName: string) => {
      delete: () => {
        eq: (columnName: string, columnValue: string) => Promise<{ error: QueryError | null }>;
      };
    };
  };

  return tableClient.from(table).delete().eq(column, value);
};

const deleteRowsForTarget = async (adminClient: SupabaseClient, target: DeleteTarget) => {
  for (const candidate of target.candidates) {
    if (!candidate.value) {
      continue;
    }

    const { error } = await deleteByColumn(adminClient, target.table, candidate.column, candidate.value);
    if (!error) {
      return;
    }

    if (isMissingTableError(error)) {
      return;
    }

    if (isMissingColumnError(error, candidate.column)) {
      continue;
    }

    throw new Error(`[${target.table}.${candidate.column}] ${error.message ?? "Delete failed."}`);
  }
};

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user || !isSupabaseUserEmailConfirmed(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase service role configuration." }, { status: 500 });
    }

    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const userId = user.id;
    const userEmail = user.email?.trim().toLowerCase() ?? null;

    const deleteTargets: DeleteTarget[] = [
      { table: "asset_media", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "documents", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "expenses", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "maintenance_rules", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "service_logs", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "billing_invoices", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "billing_subscriptions", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "subscription_requests", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }, { column: "email", value: userEmail }] },
      { table: "dismissed_alerts", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "push_subscriptions", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "audit_logs", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
      { table: "assets", candidates: [{ column: "user_id", value: userId }, { column: "owner_id", value: userId }] },
    ];

    for (const target of deleteTargets) {
      await deleteRowsForTarget(adminClient, target);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/account/delete",
      method: "POST",
      status: 500,
      error,
      message: "Account delete route failed.",
    });
    return NextResponse.json({ error: "Account delete failed." }, { status: 500 });
  }
}
