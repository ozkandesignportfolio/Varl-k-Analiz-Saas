import assert from "node:assert/strict";
import test from "node:test";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient } from "./_shared";
import { listAssets } from "./assets-repo";

const makeError = (message: string): PostgrestError =>
  ({
    code: "PGRST202",
    details: "",
    hint: "",
    message,
  }) as PostgrestError;

function createMockClient(params: {
  rpcError: PostgrestError | null;
  fallbackRows?: Array<Record<string, unknown>> | null;
  fallbackError?: PostgrestError | null;
}) {
  const queryResult = {
    data: params.fallbackRows ?? [],
    error: params.fallbackError ?? null,
  };

  const queryBuilder = {
    eq() {
      return queryBuilder;
    },
    ilike() {
      return queryBuilder;
    },
    lt() {
      return queryBuilder;
    },
    order() {
      return queryBuilder;
    },
    limit: async () => queryResult,
  };

  return {
    rpc: async () => ({ data: null, error: params.rpcError }),
    from: () => ({
      select: () => queryBuilder,
    }),
  } as unknown as DbClient;
}

test("listAssets returns fallback data without bubbling RPC error when fallback succeeds", async () => {
  const rpcError = makeError(
    "Could not find the function public.list_assets_page(...) in the schema cache",
  );
  const client = createMockClient({
    rpcError,
    fallbackRows: [
      {
        id: "asset-1",
        name: "Pompa",
        category: "Makine",
        serial_number: "SN-1",
        brand: "Brand",
        model: "M1",
        purchase_date: null,
        warranty_end_date: null,
        photo_path: null,
        qr_code: "qr-1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    fallbackError: null,
  });

  const result = await listAssets(client, { userId: "user-1" });

  assert.equal(result.error, null);
  assert.equal(result.data?.rows.length, 1);
  assert.equal(result.data?.rows[0]?.id, "asset-1");
});

test("listAssets returns fallback query error when RPC and fallback both fail", async () => {
  const rpcError = makeError("rpc failed");
  const fallbackError = makeError("fallback failed");
  const client = createMockClient({
    rpcError,
    fallbackRows: null,
    fallbackError,
  });

  const result = await listAssets(client, { userId: "user-1" });

  assert.equal(result.error?.message, "fallback failed");
});
