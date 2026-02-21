"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { countByUser as countAssetsByUser } from "@/lib/repos/assets-repo";
import { countByUser as countBillingInvoicesByUser } from "@/lib/repos/billing-invoices-repo";
import { countByUser as countBillingSubscriptionsByUser } from "@/lib/repos/billing-subscriptions-repo";
import { countByUser as countDocumentsByUser } from "@/lib/repos/documents-repo";
import { getPlanConfig, getUserPlanConfig } from "@/lib/plans/plan-config";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type UserPlan = "free" | "premium";

export type PlanContextValue = {
  plan: UserPlan;
  assetCount: number;
  assetLimit: number | null;
  documentCount: number;
  documentLimit: number | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
  invoiceUploadCount: number;
  invoiceUploadLimit: number | null;
  setAssetCount: (nextAssetCount: number) => void;
  refreshPlanState: () => Promise<void>;
};

const STARTER_PLAN = getPlanConfig("starter");

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const getPlanFromUser = (user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined): UserPlan => {
  const planConfig = getUserPlanConfig(user);
  return planConfig.code === "starter" ? "free" : "premium";
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [assetCount, setAssetCount] = useState(0);
  const [assetLimit, setAssetLimit] = useState<number | null>(STARTER_PLAN.limits.assetsLimit);
  const [documentCount, setDocumentCount] = useState(0);
  const [documentLimit, setDocumentLimit] = useState<number | null>(STARTER_PLAN.limits.documentsLimit);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [subscriptionLimit, setSubscriptionLimit] = useState<number | null>(STARTER_PLAN.limits.subscriptionsLimit);
  const [invoiceUploadCount, setInvoiceUploadCount] = useState(0);
  const [invoiceUploadLimit, setInvoiceUploadLimit] = useState<number | null>(STARTER_PLAN.limits.invoiceUploadsLimit);

  const refreshPlanState = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPlan("free");
      setAssetLimit(STARTER_PLAN.limits.assetsLimit);
      setDocumentLimit(STARTER_PLAN.limits.documentsLimit);
      setSubscriptionLimit(STARTER_PLAN.limits.subscriptionsLimit);
      setInvoiceUploadLimit(STARTER_PLAN.limits.invoiceUploadsLimit);
      setAssetCount(0);
      setDocumentCount(0);
      setSubscriptionCount(0);
      setInvoiceUploadCount(0);
      return;
    }

    const resolvedPlanConfig = getUserPlanConfig(user);
    setPlan(getPlanFromUser(user));
    setAssetLimit(resolvedPlanConfig.limits.assetsLimit);
    setDocumentLimit(resolvedPlanConfig.limits.documentsLimit);
    setSubscriptionLimit(resolvedPlanConfig.limits.subscriptionsLimit);
    setInvoiceUploadLimit(resolvedPlanConfig.limits.invoiceUploadsLimit);

    const [assetCountRes, documentCountRes, subscriptionCountRes, invoiceCountRes] = await Promise.all([
      countAssetsByUser(supabase, { userId: user.id }),
      countDocumentsByUser(supabase, { userId: user.id }),
      countBillingSubscriptionsByUser(supabase, { userId: user.id }),
      countBillingInvoicesByUser(supabase, { userId: user.id }),
    ]);

    setAssetCount(assetCountRes.error ? 0 : (assetCountRes.data ?? 0));
    setDocumentCount(documentCountRes.error ? 0 : (documentCountRes.data ?? 0));
    setSubscriptionCount(subscriptionCountRes.error ? 0 : (subscriptionCountRes.data ?? 0));
    setInvoiceUploadCount(invoiceCountRes.error ? 0 : (invoiceCountRes.data ?? 0));
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshPlanState();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshPlanState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshPlanState, supabase]);

  const value = useMemo<PlanContextValue>(
    () => ({
      plan,
      assetCount,
      assetLimit,
      documentCount,
      documentLimit,
      subscriptionCount,
      subscriptionLimit,
      invoiceUploadCount,
      invoiceUploadLimit,
      setAssetCount,
      refreshPlanState,
    }),
    [
      plan,
      assetCount,
      assetLimit,
      documentCount,
      documentLimit,
      subscriptionCount,
      subscriptionLimit,
      invoiceUploadCount,
      invoiceUploadLimit,
      refreshPlanState,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export const usePlanContext = () => {
  const value = useContext(PlanContext);
  if (!value) {
    throw new Error("usePlanContext must be used within a PlanProvider.");
  }
  return value;
};

export { PlanContext };
