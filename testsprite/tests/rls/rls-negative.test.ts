import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnv, validateRequiredSuiteEnv } from "../../scripts/load-test-env.cjs";
import { getSupabaseAdminClient, getSupabaseAnonClient, getSupabaseAdminContext } from "../e2e/helpers/supabase-admin";

loadTestEnv();
validateRequiredSuiteEnv("rls");

type AnyError = { message?: string } | null;

const userAEmail = process.env.E2E_RLS_USER_A_EMAIL?.trim() || "e2e.rls.user.a@example.com";
const userAPassword = process.env.E2E_RLS_USER_A_PASSWORD?.trim() || "E2E-Rls-A-Password!1";
const userBEmail = process.env.E2E_RLS_USER_B_EMAIL?.trim() || "e2e.rls.user.b@example.com";
const userBPassword = process.env.E2E_RLS_USER_B_PASSWORD?.trim() || "E2E-Rls-B-Password!1";
const storageBucket = "documents-private";

const assertNoError = (error: AnyError, context: string) => {
  assert.equal(error, null, `${context}: ${error?.message ?? "unknown error"}`);
};

const signInClient = async (email: string, password: string) => {
  const client = getSupabaseAnonClient();
  const signInResult = await client.auth.signInWithPassword({ email, password });
  assertNoError(signInResult.error, `signInWithPassword failed for ${email}`);

  const userId = signInResult.data.user?.id;
  assert.ok(userId, `missing user id after sign-in for ${email}`);

  return { client, userId };
};

const expectNotVisible = async (client: SupabaseClient, table: string, id: string) => {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  assertNoError(error, `select ${table}`);
  assert.equal((data ?? []).length, 0, `RLS FAIL: user_b can read user_a row in ${table}`);
};

const expectNotUpdated = async (client: SupabaseClient, table: string, id: string, patch: Record<string, unknown>) => {
  const { data, error } = await client.from(table).update(patch).eq("id", id).select("id");
  assertNoError(error, `update ${table}`);
  assert.equal((data ?? []).length, 0, `RLS FAIL: user_b can update user_a row in ${table}`);
};

const expectNotDeleted = async (client: SupabaseClient, table: string, id: string) => {
  const { data, error } = await client.from(table).delete().eq("id", id).select("id");
  assertNoError(error, `delete ${table}`);
  assert.equal((data ?? []).length, 0, `RLS FAIL: user_b can delete user_a row in ${table}`);
};

test("RLS negative: user A/B isolation across core tables + storage", { timeout: 120_000 }, async () => {
  getSupabaseAdminContext();
  const admin = getSupabaseAdminClient();

  const cleanupIds: Record<string, string | null> = {
    assetId: null,
    serviceLogId: null,
    documentId: null,
    subscriptionId: null,
    invoiceId: null,
  };
  const cleanupStoragePaths: string[] = [];

  const { client: clientA, userId: userAId } = await signInClient(userAEmail, userAPassword);
  const { client: clientB, userId: userBId } = await signInClient(userBEmail, userBPassword);

  assert.notEqual(userAId, userBId, "RLS seed users must be distinct");

  try {
    const { data: assetA, error: assetAError } = await clientA
      .from("assets")
      .insert({
        user_id: userAId,
        name: `RLS Asset A ${Date.now()}`,
        category: "RLS",
      })
      .select("id")
      .single();
    assertNoError(assetAError, "insert asset A");
    cleanupIds.assetId = assetA?.id ?? null;
    assert.ok(cleanupIds.assetId, "asset id missing");

    const { data: serviceLogA, error: serviceLogAError } = await clientA
      .from("service_logs")
      .insert({
        user_id: userAId,
        asset_id: cleanupIds.assetId,
        service_type: "RLS service",
        service_date: new Date().toISOString().slice(0, 10),
        cost: 0,
      })
      .select("id")
      .single();
    assertNoError(serviceLogAError, "insert service log A");
    cleanupIds.serviceLogId = serviceLogA?.id ?? null;
    assert.ok(cleanupIds.serviceLogId, "service log id missing");

    const documentStoragePathA = `${userAId}/${cleanupIds.assetId}/documents/rls-a-${Date.now()}.txt`;
    cleanupStoragePaths.push(documentStoragePathA);
    const uploadA = await clientA.storage
      .from(storageBucket)
      .upload(documentStoragePathA, new Blob(["rls-a"], { type: "text/plain" }), {
        contentType: "text/plain",
        upsert: true,
      });
    assertNoError(uploadA.error, "upload storage object for user A");

    const { data: documentA, error: documentAError } = await clientA
      .from("documents")
      .insert({
        user_id: userAId,
        asset_id: cleanupIds.assetId,
        service_log_id: cleanupIds.serviceLogId,
        document_type: "diger",
        file_name: "rls-a.txt",
        storage_path: documentStoragePathA,
        file_size: 5,
      })
      .select("id")
      .single();
    assertNoError(documentAError, "insert document A");
    cleanupIds.documentId = documentA?.id ?? null;
    assert.ok(cleanupIds.documentId, "document id missing");

    const { data: subscriptionA, error: subscriptionAError } = await clientA
      .from("billing_subscriptions")
      .insert({
        user_id: userAId,
        provider_name: "RLS Provider",
        subscription_name: "RLS Subscription",
        plan_name: "RLS Plan",
        billing_cycle: "monthly",
        amount: 99,
        currency: "TRY",
        status: "active",
      })
      .select("id")
      .single();
    assertNoError(subscriptionAError, "insert subscription A");
    cleanupIds.subscriptionId = subscriptionA?.id ?? null;
    assert.ok(cleanupIds.subscriptionId, "subscription id missing");

    const { data: invoiceA, error: invoiceAError } = await clientA
      .from("billing_invoices")
      .insert({
        user_id: userAId,
        subscription_id: cleanupIds.subscriptionId,
        issued_at: new Date().toISOString().slice(0, 10),
        amount: 99,
        tax_amount: 18,
        total_amount: 117,
        status: "pending",
      })
      .select("id")
      .single();
    assertNoError(invoiceAError, "insert invoice A");
    cleanupIds.invoiceId = invoiceA?.id ?? null;
    assert.ok(cleanupIds.invoiceId, "invoice id missing");

    await expectNotVisible(clientB, "assets", cleanupIds.assetId);
    await expectNotVisible(clientB, "documents", cleanupIds.documentId);
    await expectNotVisible(clientB, "service_logs", cleanupIds.serviceLogId);
    await expectNotVisible(clientB, "billing_subscriptions", cleanupIds.subscriptionId);
    await expectNotVisible(clientB, "billing_invoices", cleanupIds.invoiceId);

    await expectNotUpdated(clientB, "assets", cleanupIds.assetId, { name: "RLS breach" });
    await expectNotUpdated(clientB, "documents", cleanupIds.documentId, { file_name: "breach.txt" });
    await expectNotUpdated(clientB, "service_logs", cleanupIds.serviceLogId, { notes: "breach" });
    await expectNotUpdated(clientB, "billing_subscriptions", cleanupIds.subscriptionId, { plan_name: "breach" });
    await expectNotUpdated(clientB, "billing_invoices", cleanupIds.invoiceId, { invoice_no: "breach" });

    await expectNotDeleted(clientB, "assets", cleanupIds.assetId);
    await expectNotDeleted(clientB, "documents", cleanupIds.documentId);
    await expectNotDeleted(clientB, "service_logs", cleanupIds.serviceLogId);
    await expectNotDeleted(clientB, "billing_subscriptions", cleanupIds.subscriptionId);
    await expectNotDeleted(clientB, "billing_invoices", cleanupIds.invoiceId);

    const insertAsOtherUser = await clientB.from("assets").insert({
      user_id: userAId,
      name: `RLS Insert breach ${Date.now()}`,
      category: "RLS",
    });
    assert.ok(insertAsOtherUser.error, "RLS FAIL: user_b inserted asset for user_a");

    const documentStoragePathB = `${userBId}/rls/rls-b-${Date.now()}.txt`;
    cleanupStoragePaths.push(documentStoragePathB);
    const uploadB = await clientB.storage
      .from(storageBucket)
      .upload(documentStoragePathB, new Blob(["rls-b"], { type: "text/plain" }), {
        contentType: "text/plain",
        upsert: true,
      });
    assertNoError(uploadB.error, "upload storage object for user B");

    const signedByA = await clientA.storage.from(storageBucket).createSignedUrl(documentStoragePathA, 60);
    assertNoError(signedByA.error, "user_a createSignedUrl for own object");
    assert.ok(signedByA.data?.signedUrl, "user_a signed url missing");

    const signedByBOnA = await clientB.storage.from(storageBucket).createSignedUrl(documentStoragePathA, 60);
    assert.ok(signedByBOnA.error, "Storage FAIL: user_b created signed URL for user_a object");

    const signedByAOnB = await clientA.storage.from(storageBucket).createSignedUrl(documentStoragePathB, 60);
    assert.ok(signedByAOnB.error, "Storage FAIL: user_a created signed URL for user_b object");

    const downloadByBOnA = await clientB.storage.from(storageBucket).download(documentStoragePathA);
    assert.ok(downloadByBOnA.error, "Storage FAIL: user_b downloaded user_a object");

    const downloadByAOnB = await clientA.storage.from(storageBucket).download(documentStoragePathB);
    assert.ok(downloadByAOnB.error, "Storage FAIL: user_a downloaded user_b object");
  } finally {
    if (cleanupIds.invoiceId) {
      await admin.from("billing_invoices").delete().eq("id", cleanupIds.invoiceId);
    }
    if (cleanupIds.subscriptionId) {
      await admin.from("billing_subscriptions").delete().eq("id", cleanupIds.subscriptionId);
    }
    if (cleanupIds.documentId) {
      await admin.from("documents").delete().eq("id", cleanupIds.documentId);
    }
    if (cleanupIds.serviceLogId) {
      await admin.from("service_logs").delete().eq("id", cleanupIds.serviceLogId);
    }
    if (cleanupIds.assetId) {
      await admin.from("assets").delete().eq("id", cleanupIds.assetId);
    }
    if (cleanupStoragePaths.length > 0) {
      await admin.storage.from(storageBucket).remove(cleanupStoragePaths);
    }

    await clientA.auth.signOut();
    await clientB.auth.signOut();
  }
});
