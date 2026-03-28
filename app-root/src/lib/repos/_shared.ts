import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TableName = keyof Database["public"]["Tables"];

export type DbClient = SupabaseClient<Database>;

export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];

export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];

export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export type RepoResult<T> = Promise<{
  data: T | null;
  error: PostgrestError | null;
}>;
