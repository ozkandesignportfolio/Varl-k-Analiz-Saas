import assert from "node:assert/strict";
import test from "node:test";
import { buildBillingSchemaState, setCachedBillingSchemaState } from "@/lib/billing/schema-guard";
import type { DbClient } from "@/lib/repos/_shared";
import { createBillingSubscription } from "./billing-service";

function createMockClient() {
  let insertedValues: Record<string, unknown> | null = null;
  const lookedUpRuleIds: string[] = [];

  const client = {
    from(tableName: string) {
      if (tableName === "maintenance_rules") {
        return {
          select() {
            return {
              eq(_column: string, ruleId: string) {
                lookedUpRuleIds.push(ruleId);
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: { id: ruleId, user_id: "user-1" },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (tableName === "billing_subscriptions") {
        return {
          insert(values: Record<string, unknown>) {
            insertedValues = values;
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: "subscription-1" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table lookup: ${tableName}`);
    },
  } as unknown as DbClient;

  return {
    client,
    getInsertedValues: () => insertedValues,
    getLookedUpRuleIds: () => [...lookedUpRuleIds],
  };
}

test("createBillingSubscription keeps a valid maintenanceRuleId UUID and links it", async () => {
  setCachedBillingSchemaState(buildBillingSchemaState(["billing_subscriptions", "billing_invoices"], "request"));

  const { client, getInsertedValues, getLookedUpRuleIds } = createMockClient();
  const maintenanceRuleId = "550E8400-E29B-41D4-A716-446655440000";

  const result = await createBillingSubscription(client, {
    userId: "user-1",
    payload: {
      providerName: "Acme",
      subscriptionName: "Support Plan",
      maintenanceRuleId,
    },
  });

  assert.equal(result.status, 201);
  assert.deepEqual(getLookedUpRuleIds(), ["550e8400-e29b-41d4-a716-446655440000"]);
  assert.equal(getInsertedValues()?.maintenance_rule_id, "550e8400-e29b-41d4-a716-446655440000");
});

test("createBillingSubscription rejects an invalid maintenanceRuleId before linking", async () => {
  setCachedBillingSchemaState(buildBillingSchemaState(["billing_subscriptions", "billing_invoices"], "request"));

  const { client, getInsertedValues, getLookedUpRuleIds } = createMockClient();

  const result = await createBillingSubscription(client, {
    userId: "user-1",
    payload: {
      providerName: "Acme",
      subscriptionName: "Support Plan",
      maintenanceRuleId: "not-a-uuid",
    },
  });

  assert.deepEqual(result, {
    status: 400,
    body: { error: "Bakım kuralı kimliği geçersiz." },
  });
  assert.equal(getInsertedValues(), null);
  assert.deepEqual(getLookedUpRuleIds(), []);
});
