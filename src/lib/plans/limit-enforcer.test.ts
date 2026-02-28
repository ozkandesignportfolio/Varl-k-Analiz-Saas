import assert from "node:assert/strict";
import test from "node:test";
import type { DbClient } from "@/lib/repos/_shared";
import {
  enforceLimit,
  isPlanLimitError,
  toPlanLimitErrorBody,
} from "./limit-enforcer";

type CountTable = "assets" | "documents" | "billing_subscriptions" | "billing_invoices";

function createMockClient(params: {
  plan?: "free" | "premium" | null;
  counts?: Partial<Record<CountTable, number>>;
}) {
  const plan = params.plan ?? "free";
  const counts = params.counts ?? {};

  return {
    from(tableName: string) {
      if (tableName === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { plan }, error: null }),
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return {
            eq: async () => ({
              count: counts[tableName as CountTable] ?? 0,
              error: null,
            }),
          };
        },
      };
    },
  } as unknown as DbClient;
}

test("enforceLimit blocks when free assets limit is reached", async () => {
  const client = createMockClient({ counts: { assets: 3 } });

  await assert.rejects(
    () =>
      enforceLimit({
        client,
        userId: "user-1",
        profilePlan: "free",
        resource: "assets",
        delta: 1,
      }),
    (error: unknown) => {
      assert.equal(isPlanLimitError(error), true);
      if (!isPlanLimitError(error)) return false;
      assert.equal(error.code, "PLAN_LIMIT");
      assert.equal(error.message_tr, "Free planda en fazla 3 varlık oluşturabilirsiniz.");

      const body = toPlanLimitErrorBody(error);
      assert.equal(body.code, "PLAN_LIMIT");
      assert.equal(body.error, "Free planda en fazla 3 varlık oluşturabilirsiniz.");
      assert.equal(body.message_tr, "Free planda en fazla 3 varlık oluşturabilirsiniz.");
      return true;
    },
  );
});

test("enforceLimit allows invoices up to 5 on free plan", async () => {
  const client = createMockClient({ counts: { billing_invoices: 4 } });

  await enforceLimit({
    client,
    userId: "user-1",
    profilePlan: "free",
    resource: "invoices",
    delta: 1,
  });
});

test("enforceLimit blocks invoice creation at 6th record", async () => {
  const client = createMockClient({ counts: { billing_invoices: 5 } });

  await assert.rejects(
    () =>
      enforceLimit({
        client,
        userId: "user-1",
        profilePlan: "free",
        resource: "invoices",
        delta: 1,
      }),
    (error: unknown) => {
      assert.equal(isPlanLimitError(error), true);
      if (!isPlanLimitError(error)) return false;
      assert.equal(error.message_tr, "Free planda en fazla 5 fatura oluşturabilirsiniz.");
      return true;
    },
  );
});

test("enforceLimit reads plan from profiles table when profilePlan is omitted", async () => {
  const client = createMockClient({
    plan: "premium",
    counts: {
      assets: 999,
    },
  });

  await enforceLimit({
    client,
    userId: "user-2",
    resource: "assets",
    delta: 1,
  });
});
