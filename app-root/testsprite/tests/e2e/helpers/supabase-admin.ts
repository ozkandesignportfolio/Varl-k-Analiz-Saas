import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import loadTestEnvModule from "../../../../scripts/load-test-env.cjs";

const { loadTestEnv, validateRequiredSuiteEnv } = loadTestEnvModule as {
  loadTestEnv: () => void;
  validateRequiredSuiteEnv: (suite: string) => void;
};

loadTestEnv();
validateRequiredSuiteEnv("rls");

type SupabaseAdminContext = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

let cachedContext: SupabaseAdminContext | null = null;
let cachedAdminClient: SupabaseClient | null = null;

const PLACEHOLDER_TOKENS = [
  "<project>",
  "<project-ref>",
  "<anon-key>",
  "<service-role-key>",
  "your_url_here",
  "your_anon_key_here",
  "your_service_role_here",
  "your_project_ref",
  "your_supabase_anon_key",
  "your_supabase_service_role_key",
  "changeme",
  "replace_me",
  "placeholder",
] as const;

type RequiredEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

const readEnv = (key: RequiredEnvKey) => (process.env[key] ?? "").trim();

const looksLikePlaceholder = (value: string): boolean => {
  const lower = value.toLowerCase();
  return PLACEHOLDER_TOKENS.some((token) => lower.includes(token));
};

const formatSupabaseEnvError = (issues: string[]): string => {
  const lines = [
    "Supabase env preflight failed for RLS tests.",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "How to fix:",
    "1. Supabase Dashboard > Project Settings > API (or Data API).",
    "2. Copy values to these env vars:",
    "   - Project URL -> NEXT_PUBLIC_SUPABASE_URL",
    "   - anon/public key -> NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "   - service_role/secret key -> SUPABASE_SERVICE_ROLE_KEY",
    "3. PowerShell (current session):",
    "   $env:NEXT_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co'",
    "   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY='<anon-key>'",
    "   $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'",
    "4. Run: node scripts/print-supabase-env-check.mjs",
  ];
  return lines.join("\n");
};

export const getSupabaseAdminContext = (): SupabaseAdminContext => {
  if (cachedContext) {
    return cachedContext;
  }

  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  const issues: string[] = [];

  if (!url) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is missing.");
  } else if (looksLikePlaceholder(url)) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL looks like a placeholder.");
  } else {
    try {
      const parsed = new URL(url);
      const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttp || !parsed.hostname) {
        issues.push("NEXT_PUBLIC_SUPABASE_URL must be a valid absolute http(s) URL.");
      }
    } catch {
      issues.push("NEXT_PUBLIC_SUPABASE_URL is malformed.");
    }
  }

  if (!anonKey) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
  } else if (looksLikePlaceholder(anonKey)) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a placeholder.");
  }

  if (!serviceRoleKey) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY is missing.");
  } else if (looksLikePlaceholder(serviceRoleKey)) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY looks like a placeholder.");
  }

  if (issues.length > 0) {
    throw new Error(formatSupabaseEnvError(issues));
  }

  cachedContext = { url, anonKey, serviceRoleKey };
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
