"use client";

import {
  createContext,
  useRef,
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
import { getPlanConfig } from "@/lib/plans/plan-config";
import { getOrCreateProfilePlan } from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type UserPlan = "free" | "premium";

export type PlanContextValue = {
  userId: string | null;
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
const PREMIUM_PLAN = getPlanConfig("pro");

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const hasLoggedProfilePlanLoadWarning = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [assetCount, setAssetCount] = useState(0);
  const [assetLimit, setAssetLimit] = useState<number | null>(STARTER_PLAN.limits.assetsLimit);
  const [documentCount, setDocumentCount] = useState(0);
  const [documentLimit, setDocumentLimit] = useState<number | null>(STARTER_PLAN.limits.documentsLimit);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [subscriptionLimit, setSubscriptionLimit] = useState<number | null>(STARTER_PLAN.limits.subscriptionsLimit);
  const [invoiceUploadCount, setInvoiceUploadCount] = useState(0);
  const [invoiceUploadLimit, setInvoiceUploadLimit] = useState<number | null>(STARTER_PLAN.limits.invoiceUploadsLimit);

  const resetToFreePlan = useCallback(() => {
    setUserId(null);
    setPlan("free");
    setAssetLimit(STARTER_PLAN.limits.assetsLimit);
    setDocumentLimit(STARTER_PLAN.limits.documentsLimit);
    setSubscriptionLimit(STARTER_PLAN.limits.subscriptionsLimit);
    setInvoiceUploadLimit(STARTER_PLAN.limits.invoiceUploadsLimit);
    setAssetCount(0);
    setDocumentCount(0);
    setSubscriptionCount(0);
    setInvoiceUploadCount(0);
  }, []);

  const refreshPlanState = useCallback(async () => {
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      resetToFreePlan();
      return;
    }

    setUserId(user.id);

    const profilePlanResult = await getOrCreateProfilePlan(supabase as unknown as DbClient, user.id);

    if (profilePlanResult.error && !hasLoggedProfilePlanLoadWarning.current) {
      // This is recoverable; we continue with free-plan defaults and avoid throwing a dev error overlay.
      console.warn("Plan profile could not be loaded. Falling back to free plan.", profilePlanResult.error);
      hasLoggedProfilePlanLoadWarning.current = true;
    }

    const resolvedPlan: UserPlan = profilePlanResult.plan === "premium" ? "premium" : "free";
    const resolvedPlanConfig = resolvedPlan === "premium" ? PREMIUM_PLAN : STARTER_PLAN;
    setPlan(resolvedPlan);
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
  }, [resetToFreePlan, supabase]);

  useEffect(() => {
    let isCancelled = false;

    const runRefresh = () => {
      if (isCancelled) {
        return;
      }
      void refreshPlanState();
    };

    // Defer initial refresh one macrotask to reduce hydration-time update races.
    const initialRefreshTimer = window.setTimeout(runRefresh, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Keep auth-triggered refreshes async and outside the current call stack.
      window.setTimeout(runRefresh, 0);
    });

    return () => {
      isCancelled = true;
      window.clearTimeout(initialRefreshTimer);
      subscription.unsubscribe();
    };
  }, [refreshPlanState, supabase]);

  const value = useMemo<PlanContextValue>(
    () => ({
      userId,
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
      userId,
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

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlanContext = () => {
  const value = useContext(PlanContext);
  if (!value) {
    throw new Error("usePlanContext must be used within a PlanProvider.");
  }
  return value;
};

export { PlanContext };
