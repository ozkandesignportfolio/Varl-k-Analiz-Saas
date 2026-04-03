import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isEmailRateLimitError, isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import {
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_CONFIRMATION_DISABLED_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  normalizeEmail,
  SIGNUP_FAILED_ERROR,
} from "@/lib/supabase/signup";

export const runtime = "nodejs";

type SignupRequestBody = {
  email?: unknown;
  fullName?: unknown;
  password?: unknown;
  emailRedirectTo?: unknown;
};

const SIGNUP_USERS_PAGE_SIZE = 100;
const SIGNUP_USERS_MAX_PAGES = 200;

const notificationPreferences = {
  maintenance: true,
  maintenance_email: true,
  warranty: true,
  warranty_email: true,
  document: true,
  document_email: true,
  documentExpiry: true,
  document_expiry: true,
  document_expiry_email: true,
  service: true,
  service_logs: true,
  service_log: true,
  service_email: true,
  payment: true,
  subscription_email: true,
  system: true,
  inApp: true,
  in_app: true,
  email: true,
  frequency: "Aninda",
};

const getRequiredEnv = (key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getAuthClients = () => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    signUpClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
};

const findExistingUserByEmail = async (email: string) => {
  const { adminClient } = getAuthClients();
  const normalizedEmail = normalizeEmail(email);

  for (let page = 1; page <= SIGNUP_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: SIGNUP_USERS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`listUsers failed on page ${page}: ${error.message}`);
    }

    const existingUser = (data.users ?? []).find((user) => normalizeEmail(user.email ?? "") === normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    if ((data.users ?? []).length < SIGNUP_USERS_PAGE_SIZE) {
      return null;
    }
  }

  return null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupRequestBody;
    const fullName = isNonEmptyString(body.fullName) ? body.fullName.trim() : "";
    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const emailRedirectTo = isNonEmptyString(body.emailRedirectTo) ? body.emailRedirectTo.trim() : "";

    if (!fullName || !email || !password || !emailRedirectTo) {
      return NextResponse.json(
        {
          error: SIGNUP_FAILED_ERROR,
          message: "Missing required signup fields.",
        },
        { status: 400 },
      );
    }

    const existingUser = await findExistingUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: EMAIL_ALREADY_EXISTS_ERROR }, { status: 409 });
    }

    const { signUpClient } = getAuthClients();
    const { data, error } = await signUpClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          notification_preferences: notificationPreferences,
          notificationPreferences,
        },
      },
    });

    if (error) {
      if (isEmailRateLimitError(error)) {
        return NextResponse.json({ error: EMAIL_RATE_LIMITED_ERROR }, { status: 429 });
      }

      return NextResponse.json(
        {
          error: SIGNUP_FAILED_ERROR,
          message: error.message || "Signup failed.",
        },
        { status: 400 },
      );
    }

    if (data.session && data.user && isSupabaseUserEmailConfirmed(data.user)) {
      return NextResponse.json({ error: EMAIL_CONFIRMATION_DISABLED_ERROR }, { status: 409 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[auth.signup] Failed to create signup.", error);
    return NextResponse.json(
      {
        error: SIGNUP_FAILED_ERROR,
        message: "Kayit sirasinda beklenmeyen bir hata olustu.",
      },
      { status: 500 },
    );
  }
}
