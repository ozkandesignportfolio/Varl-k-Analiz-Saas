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
import { getUserPlanConfig } from "@/lib/plans/plan-config";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type UserPlan = "free" | "premium";

export type PlanContextValue = {
  plan: UserPlan;
  assetCount: number;
  assetLimit: number | null;
  setAssetCount: (nextAssetCount: number) => void;
  refreshPlanState: () => Promise<void>;
};

const FREE_ASSET_LIMIT = 3;

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const getPlanFromUser = (user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined): UserPlan => {
  const planConfig = getUserPlanConfig(user);
  return planConfig.code === "starter" ? "free" : "premium";
};

const getAssetLimitByPlan = (plan: UserPlan) => (plan === "free" ? FREE_ASSET_LIMIT : null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [assetCount, setAssetCount] = useState(0);
  const [assetLimit, setAssetLimit] = useState<number | null>(FREE_ASSET_LIMIT);

  const refreshPlanState = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPlan("free");
      setAssetLimit(FREE_ASSET_LIMIT);
      setAssetCount(0);
      return;
    }

    const resolvedPlan = getPlanFromUser(user);
    setPlan(resolvedPlan);
    setAssetLimit(getAssetLimitByPlan(resolvedPlan));

    const { data: nextAssetCount } = await countAssetsByUser(supabase, { userId: user.id });
    setAssetCount(nextAssetCount ?? 0);
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
      setAssetCount,
      refreshPlanState,
    }),
    [assetCount, assetLimit, plan, refreshPlanState],
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
