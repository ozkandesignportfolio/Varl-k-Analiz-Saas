import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./_load-env-local.mjs";

loadEnvLocal();

const requireEnv = (key) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  {
    label: "critical",
    email: "e2e@test.com",
    password: "Komplo34?",
    displayName: "E2E Flow User",
    plan: "free",
  },
  {
    label: "trial",
    email: "trial@test.com",
    password: "Komplo34?",
    displayName: "Trial Test User",
    plan: "free",
  },
  {
    label: "premium",
    email: "premium@test.com",
    password: "Komplo34?",
    displayName: "Premium Test User",
    plan: "premium",
  },
  {
    label: "rls-a",
    email: "rls.user.a@test.com",
    password: "Komplo34?",
    displayName: "RLS User A",
    plan: "free",
  },
  {
    label: "rls-b",
    email: "rls.user.b@test.com",
    password: "Komplo34?",
    displayName: "RLS User B",
    plan: "free",
  },
];

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

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

const buildUserMetadata = (existingMetadata, displayName, plan) => ({
  ...(isObject(existingMetadata) ? existingMetadata : {}),
  ...planMetadataByPlan(plan),
  display_name: displayName,
  full_name: displayName,
  name: displayName,
});

const buildAppMetadata = (existingMetadata, plan) => ({
  ...(isObject(existingMetadata) ? existingMetadata : {}),
  ...planMetadataByPlan(plan),
});

const listAllUsers = async () => {
  const allUsers = [];
  let page = 1;

  while (page <= 200) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error(`listUsers failed on page ${page}: ${error.message}`);
    }

    const users = data?.users ?? [];
    allUsers.push(...users);

    if (users.length < 100) {
      break;
    }

    page += 1;
  }

  return allUsers;
};

const ensureDocumentsBucket = async () => {
  const current = await admin.storage.getBucket("documents-private");
  if (!current.error && current.data) {
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
  const tables = [
    "media_enrichment_jobs",
    "billing_invoices",
    "billing_subscriptions",
    "documents",
    "service_logs",
    "maintenance_rules",
    "asset_media",
    "assets",
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) {
      throw new Error(`cleanup failed for ${table} (${userId}): ${error.message}`);
    }
  }
};

const ensureProfile = async (userId, plan) => {
  const { data: existingProfile, error: selectError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`profiles select failed for ${userId}: ${selectError.message}`);
  }

  if (!existingProfile) {
    const { error: insertError } = await admin.from("profiles").insert({ id: userId, plan });
    if (insertError) {
      throw new Error(`profiles insert failed for ${userId}: ${insertError.message}`);
    }
    return;
  }

  const { error: updateError } = await admin.from("profiles").update({ plan }).eq("id", userId);
  if (!updateError) {
    return;
  }

  if (!updateError.message.includes('has no field "updated_at"')) {
    throw new Error(`profiles update failed for ${userId}: ${updateError.message}`);
  }

  const { error: deleteError } = await admin.from("profiles").delete().eq("id", userId);
  if (deleteError) {
    throw new Error(`profiles delete fallback failed for ${userId}: ${deleteError.message}`);
  }

  const { error: reinsertError } = await admin.from("profiles").insert({ id: userId, plan });
  if (reinsertError) {
    throw new Error(`profiles reinsert fallback failed for ${userId}: ${reinsertError.message}`);
  }
};

const ensureAuthUser = async (userConfig, existingUser) => {
  const user_metadata = buildUserMetadata(existingUser?.user_metadata, userConfig.displayName, userConfig.plan);
  const app_metadata = buildAppMetadata(existingUser?.app_metadata, userConfig.plan);

  if (existingUser?.id) {
    const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
      email: userConfig.email,
      password: userConfig.password,
      email_confirm: true,
      ban_duration: "none",
      user_metadata,
      app_metadata,
    });

    if (error) {
      throw new Error(`updateUserById failed for ${userConfig.email}: ${error.message}`);
    }

    return existingUser.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: userConfig.email,
    password: userConfig.password,
    email_confirm: true,
    user_metadata,
    app_metadata,
  });

  const userId = data?.user?.id;
  if (error || !userId) {
    throw new Error(`createUser failed for ${userConfig.email}: ${error?.message ?? "missing user id"}`);
  }

  return userId;
};

const main = async () => {
  await ensureDocumentsBucket();

  const users = await listAllUsers();
  const usersByEmail = new Map(users.map((user) => [(user.email ?? "").toLowerCase(), user]));

  const seededUsers = [];

  for (const userConfig of TEST_USERS) {
    const existingUser = usersByEmail.get(userConfig.email.toLowerCase()) ?? null;

    const userId = await ensureAuthUser(userConfig, existingUser);
    await ensureProfile(userId, userConfig.plan);
    await cleanupTenantRows(userId);

    seededUsers.push({
      label: userConfig.label,
      id: userId,
      email: userConfig.email,
      plan: userConfig.plan,
      display_name: userConfig.displayName,
    });
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
