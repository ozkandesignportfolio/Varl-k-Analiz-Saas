import { createClient } from "@supabase/supabase-js";

const must = (value, key) => {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return String(value).trim();
};

const SUPABASE_URL = must(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = must(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

const userAEmail = process.env.E2E_RLS_USER_A_EMAIL?.trim() || "e2e.rls.user.a@example.com";
const userAPassword = process.env.E2E_RLS_USER_A_PASSWORD?.trim() || "E2E-Rls-A-Password!1";
const userBEmail = process.env.E2E_RLS_USER_B_EMAIL?.trim() || "e2e.rls.user.b@example.com";
const userBPassword = process.env.E2E_RLS_USER_B_PASSWORD?.trim() || "E2E-Rls-B-Password!1";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

const ensureUser = async ({ email, password, fullName }) => {
  const users = await listAllUsers();
  const existing = users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: fullName,
      },
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
    user_metadata: {
      full_name: fullName,
    },
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
  await admin.from("billing_invoices").delete().eq("user_id", userId);
  await admin.from("billing_subscriptions").delete().eq("user_id", userId);
  await admin.from("documents").delete().eq("user_id", userId);
  await admin.from("service_logs").delete().eq("user_id", userId);
  await admin.from("maintenance_rules").delete().eq("user_id", userId);
  await admin.from("asset_media").delete().eq("user_id", userId);
  await admin.from("assets").delete().eq("user_id", userId);
};

const ensureProfileRow = async (userId) => {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan: "free",
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`profiles upsert failed for ${userId}: ${error.message}`);
  }
};

const main = async () => {
  const userAId = await ensureUser({
    email: userAEmail,
    password: userAPassword,
    fullName: "E2E RLS User A",
  });
  const userBId = await ensureUser({
    email: userBEmail,
    password: userBPassword,
    fullName: "E2E RLS User B",
  });

  await ensureProfileRow(userAId);
  await ensureProfileRow(userBId);
  await cleanupTenantRows(userAId);
  await cleanupTenantRows(userBId);
  await ensureDocumentsBucket();

  console.log(
    JSON.stringify(
      {
        ok: true,
        seededUsers: [
          { id: userAId, email: userAEmail },
          { id: userBId, email: userBEmail },
        ],
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
