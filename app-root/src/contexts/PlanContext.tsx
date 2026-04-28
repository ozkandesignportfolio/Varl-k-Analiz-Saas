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
import { ensureProfile, getProfilePlanFromUserMetadata, getProfileSubscriptionStatus } from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";
import { isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BuildEnv } from "@/lib/env/build-env";
import { PublicEnv } from "@/lib/env/public-env";

export type UserPlan = "free" | "premium";

export type PlanContextValue = {
  userId: string | null;
  plan: UserPlan;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  isLoading: boolean;
  assetCount: number;
  assetLimit: number | null;
  documentCount: number;
  documentLimit: number | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
  invoiceUploadCount: number;
  invoiceUploadLimit: number | null;
  canExportPdfReports: boolean;
  canUseAdvancedAnalytics: boolean;
  canUseAutomation: boolean;
  setAssetCount: (nextAssetCount: number) => void;
  refreshPlanState: () => Promise<void>;
};

const STARTER_PLAN = getPlanConfig("starter");
const PREMIUM_PLAN = getPlanConfig("pro");
const CLIENT_PLAN_CACHE_TTL_MS = 30_000;
const forceProfileFromDb = PublicEnv.NEXT_PUBLIC_AUTH_FORCE_PROFILE_FROM_DB === "1";

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children }: { children: ReactNode }) {
  const isDev = BuildEnv.NODE_ENV !== "production";
  const showPlanDebug = isDev && PublicEnv.NEXT_PUBLIC_PLAN_DEBUG === "true";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const hasLoggedProfilePlanLoadWarning = useRef(false);
  const planCacheByUserRef = useRef(new Map<string, { plan: UserPlan; expiresAt: number }>());
  const [devPlanWarning, setDevPlanWarning] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [assetCount, setAssetCount] = useState(0);
  const [assetLimit, setAssetLimit] = useState<number | null>(STARTER_PLAN.limits.assetsLimit);
  const [documentCount, setDocumentCount] = useState(0);
  const [documentLimit, setDocumentLimit] = useState<number | null>(STARTER_PLAN.limits.documentsLimit);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [subscriptionLimit, setSubscriptionLimit] = useState<number | null>(STARTER_PLAN.limits.subscriptionsLimit);
  const [invoiceUploadCount, setInvoiceUploadCount] = useState(0);
  const [invoiceUploadLimit, setInvoiceUploadLimit] = useState<number | null>(STARTER_PLAN.limits.invoiceUploadsLimit);
  const [canExportPdfReports, setCanExportPdfReports] = useState(false);
  const [canUseAdvancedAnalytics, setCanUseAdvancedAnalytics] = useState(false);
  const [canUseAutomation, setCanUseAutomation] = useState(false);

  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);

  const resetToFreePlan = useCallback(() => {
    setUserId(null);
    setPlan("free");
    setCancelAtPeriodEnd(false);
    setCurrentPeriodEnd(null);
    setAssetLimit(STARTER_PLAN.limits.assetsLimit);
    setDocumentLimit(STARTER_PLAN.limits.documentsLimit);
    setSubscriptionLimit(STARTER_PLAN.limits.subscriptionsLimit);
    setInvoiceUploadLimit(STARTER_PLAN.limits.invoiceUploadsLimit);
    setAssetCount(0);
    setDocumentCount(0);
    setSubscriptionCount(0);
    setInvoiceUploadCount(0);
    setCanExportPdfReports(false);
    setCanUseAdvancedAnalytics(false);
    setCanUseAutomation(false);
  }, []);

  const refreshPlanState = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError || !user) {
        if (isDev) {
          setDevPlanWarning(null);
        }
        resetToFreePlan();
        return;
      }

      if (!isSupabaseUserEmailConfirmed(user)) {
        await supabase.auth.signOut();
        if (isDev) {
          setDevPlanWarning("email verification required");
        }
        resetToFreePlan();
        return;
      }

      setUserId(user.id);

      const metadataPlan = forceProfileFromDb ? null : getProfilePlanFromUserMetadata(user);
      const cachedPlanEntry = planCacheByUserRef.current.get(user.id);
      const cachedPlan =
        !forceProfileFromDb && cachedPlanEntry && cachedPlanEntry.expiresAt > Date.now() ? cachedPlanEntry.plan : null;

      const profilePlanResult =
        metadataPlan || cachedPlan
          ? { plan: (metadataPlan ?? cachedPlan) as UserPlan, error: null }
          : await ensureProfile(supabase as unknown as DbClient, user.id);

      if (profilePlanResult.error && !hasLoggedProfilePlanLoadWarning.current) {
        console.warn("Plan profile could not be loaded. Falling back to free plan.", profilePlanResult.error);
        hasLoggedProfilePlanLoadWarning.current = true;
      }
      if (isDev) {
        setDevPlanWarning(profilePlanResult.error);
      }

      const resolvedPlan: UserPlan = profilePlanResult.plan === "premium" ? "premium" : "free";
      const resolvedPlanConfig = resolvedPlan === "premium" ? PREMIUM_PLAN : STARTER_PLAN;
      planCacheByUserRef.current.set(user.id, {
        plan: resolvedPlan,
        expiresAt: Date.now() + CLIENT_PLAN_CACHE_TTL_MS,
      });
      setPlan(resolvedPlan);
      setAssetLimit(resolvedPlanConfig.limits.assetsLimit);
      setDocumentLimit(resolvedPlanConfig.limits.documentsLimit);
      setSubscriptionLimit(resolvedPlanConfig.limits.subscriptionsLimit);
      setInvoiceUploadLimit(resolvedPlanConfig.limits.invoiceUploadsLimit);
      setCanExportPdfReports(resolvedPlanConfig.features.canExportPdfReports);
      setCanUseAdvancedAnalytics(resolvedPlanConfig.features.canUseAdvancedAnalytics);
      setCanUseAutomation(resolvedPlanConfig.features.canUseAutomation);

      const subStatus = await getProfileSubscriptionStatus(supabase as unknown as DbClient, user.id);
      setCancelAtPeriodEnd(subStatus.cancelAtPeriodEnd);
      setCurrentPeriodEnd(subStatus.currentPeriodEnd);

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
    } catch (error) {
      if (isDev) {
        const message = error instanceof Error ? error.message : "unknown plan error";
        setDevPlanWarning(`plan state error: ${message}`);
      }
      resetToFreePlan();
    } finally {
      setIsLoading(false);
    }
  }, [isDev, resetToFreePlan, supabase]);

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
      cancelAtPeriodEnd,
      currentPeriodEnd,
      isLoading,
      assetCount,
      assetLimit,
      documentCount,
      documentLimit,
      subscriptionCount,
      subscriptionLimit,
      invoiceUploadCount,
      invoiceUploadLimit,
      canExportPdfReports,
      canUseAdvancedAnalytics,
      canUseAutomation,
      setAssetCount,
      refreshPlanState,
    }),
    [
      userId,
      plan,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      isLoading,
      assetCount,
      assetLimit,
      documentCount,
      documentLimit,
      subscriptionCount,
      subscriptionLimit,
      invoiceUploadCount,
      invoiceUploadLimit,
      canExportPdfReports,
      canUseAdvancedAnalytics,
      canUseAutomation,
      refreshPlanState,
    ],
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      {showPlanDebug && devPlanWarning ? (
        <div className="pointer-events-none fixed bottom-3 right-3 z-[90] rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900 shadow-sm">
          Plan debug: {devPlanWarning}
        </div>
      ) : null}
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

export type PlanIdentityContextValue = Pick<PlanContextValue, "userId" | "plan" | "isLoading">;

export const usePlanIdentityContext = (): PlanIdentityContextValue => {
  const { userId, plan, isLoading } = usePlanContext();
  return { userId, plan, isLoading };
};

export type PlanUsageContextValue = Pick<
  PlanContextValue,
  | "assetCount"
  | "assetLimit"
  | "documentCount"
  | "documentLimit"
  | "subscriptionCount"
  | "subscriptionLimit"
  | "invoiceUploadCount"
  | "invoiceUploadLimit"
  | "setAssetCount"
>;

export const usePlanUsageContext = (): PlanUsageContextValue => {
  const {
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    subscriptionCount,
    subscriptionLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    setAssetCount,
  } = usePlanContext();

  return {
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    subscriptionCount,
    subscriptionLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    setAssetCount,
  };
};

export { PlanContext };
