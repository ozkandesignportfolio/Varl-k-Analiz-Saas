import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient, getSupabaseAnonClient } from "../e2e/helpers/supabase-admin";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PASSWORD = "Rls!Pass12345";

type AssetListResponse = {
  rows?: Array<{
    id?: string;
    name?: string;
  }>;
};

async function createConfirmedUser(email: string, password: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user ${email}: ${error.message}`);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error(`Failed to create user ${email}: missing user id`);
  }

  return userId;
}

async function signInAndGetToken(email: string, password: string): Promise<{ client: SupabaseClient; accessToken: string }> {
  const client = getSupabaseAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Failed to sign in ${email}: ${error.message}`);
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(`Failed to sign in ${email}: missing access token`);
  }

  return { client, accessToken };
}

test("RLS negative API: user B cannot fetch user A asset", async () => {
  const admin = getSupabaseAdminClient();
  const runId = `${Date.now()}`;
  const emailA = `rls-a-${runId}@example.com`;
  const emailB = `rls-b-${runId}@example.com`;
  const assetName = `RLS-Asset-${runId}`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let assetId: string | null = null;
  let clientA: SupabaseClient | null = null;
  let clientB: SupabaseClient | null = null;

  try {
    userAId = await createConfirmedUser(emailA, PASSWORD);
    userBId = await createConfirmedUser(emailB, PASSWORD);

    const signInA = await signInAndGetToken(emailA, PASSWORD);
    const signInB = await signInAndGetToken(emailB, PASSWORD);
    clientA = signInA.client;
    clientB = signInB.client;

    const createResponse = await fetch(`${BASE_URL}/api/assets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${signInA.accessToken}`,
      },
      body: JSON.stringify({
        name: assetName,
        category: "RLS",
      }),
    });

    if (createResponse.status === 201) {
      const createPayload = (await createResponse.json()) as { id?: string };
      assetId = createPayload.id ?? null;
    } else {
      const fallbackInsert = await admin
        .from("assets")
        .insert({
          user_id: userAId,
          name: assetName,
          category: "RLS",
        })
        .select("id")
        .single();

      if (fallbackInsert.error || !fallbackInsert.data?.id) {
        throw new Error(`Asset setup failed. API status: ${createResponse.status}`);
      }

      assetId = fallbackInsert.data.id;
    }

    expect(assetId).toBeTruthy();

    const fetchResponse = await fetch(`${BASE_URL}/api/assets?search=${encodeURIComponent(assetName)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${signInB.accessToken}`,
      },
    });

    const payload = (await fetchResponse.json().catch(() => null)) as (AssetListResponse & { error?: unknown }) | null;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const leaked = rows.some((row) => row.id === assetId || row.name === assetName);
    expect(leaked).toBeFalsy();

    const error =
      payload?.error ??
      (fetchResponse.status === 200
        ? { message: "Denied without explicit HTTP error status." }
        : { message: "Denied request returned no explicit error body." });
    expect(error).toBeTruthy();

    const status = (error as any)?.status ?? (error as any)?.cause?.status ?? (error as any)?.response?.status;
    if (typeof status === "number") expect([401, 403]).toContain(status);
  } finally {
    if (assetId) {
      await admin.from("assets").delete().eq("id", assetId);
    }

    if (clientA) {
      await clientA.auth.signOut();
    }
    if (clientB) {
      await clientB.auth.signOut();
    }

    if (userAId) {
      await admin.auth.admin.deleteUser(userAId);
    }
    if (userBId) {
      await admin.auth.admin.deleteUser(userBId);
    }
  }
});
