import assert from "node:assert/strict";
import test from "node:test";
import type { DbClient } from "@/lib/repos/_shared";
import { enforceLimit, isPlanLimitError, toPlanLimitErrorBody } from "./limit-enforcer";

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

test("enforceLimit blocks assets creation when free limit is reached", async () => {
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
      const body = toPlanLimitErrorBody(error);
      assert.deepEqual(body, {
        code: "PLAN_LIMIT",
        message: "Free planda en fazla 3 varlik olusturabilirsiniz.",
        limit: 3,
        resource: "assets",
      });
      return true;
    },
  );
});

test("enforceLimit blocks documents creation when free limit is reached", async () => {
  const client = createMockClient({ counts: { documents: 5 } });

  await assert.rejects(
    () =>
      enforceLimit({
        client,
        userId: "user-1",
        profilePlan: "free",
        resource: "documents",
        delta: 1,
      }),
    (error: unknown) => {
      assert.equal(isPlanLimitError(error), true);
      if (!isPlanLimitError(error)) return false;
      const body = toPlanLimitErrorBody(error);
      assert.deepEqual(body, {
        code: "PLAN_LIMIT",
        message: "Free planda en fazla 5 belge yukleyebilirsiniz.",
        limit: 5,
        resource: "documents",
      });
      return true;
    },
  );
});

test("enforceLimit blocks subscriptions creation when free limit is reached", async () => {
  const client = createMockClient({ counts: { billing_subscriptions: 3 } });

  await assert.rejects(
    () =>
      enforceLimit({
        client,
        userId: "user-1",
        profilePlan: "free",
        resource: "subscriptions",
        delta: 1,
      }),
    (error: unknown) => {
      assert.equal(isPlanLimitError(error), true);
      if (!isPlanLimitError(error)) return false;
      const body = toPlanLimitErrorBody(error);
      assert.deepEqual(body, {
        code: "PLAN_LIMIT",
        message: "Free planda en fazla 3 abonelik olusturabilirsiniz.",
        limit: 3,
        resource: "subscriptions",
      });
      return true;
    },
  );
});

test("enforceLimit blocks invoices creation when free limit is reached", async () => {
  const client = createMockClient({ counts: { billing_invoices: 3 } });

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
      const body = toPlanLimitErrorBody(error);
      assert.deepEqual(body, {
        code: "PLAN_LIMIT",
        message: "Free planda en fazla 3 fatura olusturabilirsiniz.",
        limit: 3,
        resource: "invoices",
      });
      return true;
    },
  );
});

test("enforceLimit allows creating the third invoice on free plan", async () => {
  const client = createMockClient({ counts: { billing_invoices: 2 } });

  await assert.doesNotReject(() =>
    enforceLimit({
      client,
      userId: "user-1",
      profilePlan: "free",
      resource: "invoices",
      delta: 1,
    }),
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
