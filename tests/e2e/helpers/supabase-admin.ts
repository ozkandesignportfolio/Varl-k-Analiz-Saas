import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type SupabaseAdminContext = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

let cachedContext: SupabaseAdminContext | null = null;
let cachedAdminClient: SupabaseClient | null = null;

const must = (value: string | undefined, key: string) => {
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value.trim();
};

export const getSupabaseAdminContext = (): SupabaseAdminContext => {
  if (cachedContext) {
    return cachedContext;
  }

  cachedContext = {
    url: must(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: must(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: must(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
  };
  return cachedContext;
};

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const context = getSupabaseAdminContext();
  cachedAdminClient = createClient(context.url, context.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedAdminClient;
};

export const getSupabaseAnonClient = () => {
  const context = getSupabaseAdminContext();
  return createClient(context.url, context.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = getSupabaseAdminClient();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const found = data.users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) {
      return found;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }

  return null;
}

export async function confirmUserEmail(email: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const user = await findAuthUserByEmail(email);

  if (!user) {
    throw new Error(`Cannot confirm email; auth user not found: ${email}`);
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to confirm email for ${email}: ${error.message}`);
  }

  return user.id;
}
