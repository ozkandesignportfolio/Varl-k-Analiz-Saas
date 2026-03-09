import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./_load-env-local.mjs";

loadEnvLocal();

const must = (value, key) => {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return String(value).trim();
};

const SUPABASE_URL = must(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = must(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const firstEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
};

const listAllUsers = async () => {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }

    users.push(...data.users);
    if (data.users.length < 100) {
      break;
    }
  }
  return users;
};

const planMetadataByPlan = (plan) => {
  if (plan === "premium") {
    return {
      plan: "premium",
      tier: "premium",
      plan_code: "pro",
      planCode: "pro",
      subscription_plan: "premium",
      subscriptionPlan: "premium",
    };
  }

  return {
    plan: "free",
    tier: "free",
    plan_code: "starter",
    planCode: "starter",
    subscription_plan: "free",
    subscriptionPlan: "free",
  };
};

const ensureUser = async ({ email, password, fullName, plan }) => {
  const users = await listAllUsers();
  const existing = users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
  const metadata = {
    ...(existing?.user_metadata ?? {}),
    ...planMetadataByPlan(plan),
    full_name: fullName,
  };
  const appMetadata = {
    ...(existing?.app_metadata ?? {}),
    ...planMetadataByPlan(plan),
  };

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
      user_metadata: metadata,
      app_metadata: appMetadata,
    });
    if (error) {
      throw new Error(`updateUserById failed for ${email}: ${error.message}`);
    }

    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: appMetadata,
  });

  if (error || !data.user?.id) {
    throw new Error(`createUser failed for ${email}: ${error?.message ?? "user id missing"}`);
  }

  return data.user.id;
};

const ensureDocumentsBucket = async () => {
  const { data, error } = await admin.storage.getBucket("documents-private");
  if (!error && data) {
    return;
  }

  const created = await admin.storage.createBucket("documents-private", {
    public: false,
    fileSizeLimit: "50MB",
  });

  if (created.error && !String(created.error.message ?? "").toLowerCase().includes("already exists")) {
    throw new Error(`createBucket documents-private failed: ${created.error.message}`);
  }
};

const cleanupTenantRows = async (userId) => {
  await admin.from("media_enrichment_jobs").delete().eq("user_id", userId);
  await admin.from("billing_invoices").delete().eq("user_id", userId);
  await admin.from("billing_subscriptions").delete().eq("user_id", userId);
  await admin.from("documents").delete().eq("user_id", userId);
  await admin.from("service_logs").delete().eq("user_id", userId);
  await admin.from("maintenance_rules").delete().eq("user_id", userId);
  await admin.from("asset_media").delete().eq("user_id", userId);
  await admin.from("assets").delete().eq("user_id", userId);
};

const ensureProfileRow = async (userId, plan) => {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`profiles upsert failed for ${userId}: ${error.message}`);
  }
};

const buildSeedUsers = () => {
  const stable = [
    {
      email: firstEnv("TRIAL_EMAIL", "TRIAL_LOGIN_EMAIL", "TEST_LOGIN_EMAIL"),
      password: firstEnv("TRIAL_PASSWORD", "TRIAL_LOGIN_PASSWORD", "TEST_LOGIN_PASSWORD"),
      plan: "free",
      fullName: "E2E Trial User",
      label: "trial",
    },
    {
      email: firstEnv("PREMIUM_EMAIL", "PREMIUM_LOGIN_EMAIL", "TEST_ALT_LOGIN_EMAIL"),
      password: firstEnv("PREMIUM_PASSWORD", "PREMIUM_LOGIN_PASSWORD", "TEST_ALT_LOGIN_PASSWORD"),
      plan: "premium",
      fullName: "E2E Premium User",
      label: "premium",
    },
    {
      email: firstEnv("E2E_EMAIL"),
      password: firstEnv("E2E_PASSWORD"),
      plan: "free",
      fullName: "E2E Critical User",
      label: "critical",
    },
  ];

  const rls = [
    {
      email: firstEnv("E2E_RLS_USER_A_EMAIL") ?? "e2e.rls.user.a@example.com",
      password: firstEnv("E2E_RLS_USER_A_PASSWORD") ?? "E2E-Rls-A-Password!1",
      plan: "free",
      fullName: "E2E RLS User A",
      label: "rls-a",
    },
    {
      email: firstEnv("E2E_RLS_USER_B_EMAIL") ?? "e2e.rls.user.b@example.com",
      password: firstEnv("E2E_RLS_USER_B_PASSWORD") ?? "E2E-Rls-B-Password!1",
      plan: "free",
      fullName: "E2E RLS User B",
      label: "rls-b",
    },
  ];

  const seeds = [...stable, ...rls];
  const seen = new Set();

  return seeds.filter((candidate) => {
    if (!candidate.email || !candidate.password) {
      return false;
    }

    const key = candidate.email.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const main = async () => {
  await ensureDocumentsBucket();

  const seededUsers = [];
  const seen = new Map();

  for (const config of buildSeedUsers()) {
    const userId = await ensureUser({
      email: config.email,
      password: config.password,
      fullName: config.fullName,
      plan: config.plan,
    });

    await ensureProfileRow(userId, config.plan);
    await cleanupTenantRows(userId);

    seen.set(config.label, {
      id: userId,
      email: config.email,
      plan: config.plan,
    });
  }

  for (const [label, entry] of seen.entries()) {
    seededUsers.push({ label, ...entry });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        seededUsers,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
