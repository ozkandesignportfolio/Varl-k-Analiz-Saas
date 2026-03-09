"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { SIDEBAR_TEXT } from "@/constants/ui-text";

const INITIAL_USAGE_LIMIT = 3;
const FREE_PLAN_LABEL = SIDEBAR_TEXT.freePlanLabel;

export type PlanDebugResponse =
  | {
      ok: true;
      uid: string;
      plan: string | null;
      profileExists: boolean;
      error: null;
    }
  | {
      ok: false;
      uid?: string;
      reason?: string;
      error?: string;
    };

type SidebarFooterProps = {
  plan: string;
  assetCount: number;
  assetLimit: number | null;
  documentCount: number;
  documentLimit: number | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
  invoiceUploadCount: number;
  invoiceUploadLimit: number | null;
  showPlanDebug: boolean;
  planDebug: PlanDebugResponse | null;
  onNavigate?: () => void;
  footer?: ReactNode;
};

const formatUsage = (count: number, limit: number | null) => `${count}/${limit ?? SIDEBAR_TEXT.infiniteLimit}`;

export function SidebarFooter({
  plan,
  assetCount,
  assetLimit,
  documentCount,
  documentLimit,
  subscriptionCount,
  subscriptionLimit,
  invoiceUploadCount,
  invoiceUploadLimit,
  showPlanDebug,
  planDebug,
  onNavigate,
  footer,
}: SidebarFooterProps) {
  const isFreePlan = plan === "free";
  const usageLimit = assetLimit ?? INITIAL_USAGE_LIMIT;

  const usagePercent = useMemo(() => {
    if (!isFreePlan || usageLimit <= 0) {
      return 100;
    }

    const ratios = [
      assetLimit && assetLimit > 0 ? assetCount / assetLimit : 0,
      documentLimit && documentLimit > 0 ? documentCount / documentLimit : 0,
      subscriptionLimit && subscriptionLimit > 0 ? subscriptionCount / subscriptionLimit : 0,
      invoiceUploadLimit && invoiceUploadLimit > 0 ? invoiceUploadCount / invoiceUploadLimit : 0,
    ];
    const highestRatio = Math.max(...ratios);
    return Math.max(0, Math.min(100, Math.round(highestRatio * 100)));
  }, [
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    isFreePlan,
    subscriptionCount,
    subscriptionLimit,
    usageLimit,
  ]);

  const debugUid = planDebug?.uid ?? "null";
  const debugPlan = planDebug?.ok ? (planDebug.plan ?? "null") : "null";
  const debugProfile = planDebug?.ok ? (planDebug.profileExists ? "exists" : "missing") : "missing";
  const debugError = planDebug?.ok ? null : planDebug?.error ?? planDebug?.reason ?? null;

  return (
    <div className="auth-sidebar-footer mt-3 flex flex-col gap-3 pb-3">
      {showPlanDebug ? (
        <div className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-300 opacity-60">
          <p>DEBUG uid: {debugUid}</p>
          <p>DEBUG plan: {debugPlan}</p>
          <p>DEBUG profile: {debugProfile}</p>
          {debugError ? <p>DEBUG error: {debugError}</p> : null}
        </div>
      ) : null}

      {plan !== "premium" ? (
        <article className="auth-plan-card auth-plan-card-free rounded-xl p-3" data-testid="sidebar-plan-limit-card">
          <p className="text-xs tracking-[0.2em] text-amber-100">{FREE_PLAN_LABEL}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--auth-foreground)]" data-testid="sidebar-plan-assets">
            {SIDEBAR_TEXT.usageAssets}: {formatUsage(assetCount, assetLimit)}
          </p>
          <p className="mt-1 text-xs text-[var(--auth-muted)]" data-testid="sidebar-plan-documents">
            {SIDEBAR_TEXT.usageDocuments}: {formatUsage(documentCount, documentLimit)}
          </p>
          <p className="mt-1 text-xs text-[var(--auth-muted)]" data-testid="sidebar-plan-subscriptions">
            {SIDEBAR_TEXT.usageSubscriptions}: {formatUsage(subscriptionCount, subscriptionLimit)}
          </p>
          <p className="mt-1 text-xs text-[var(--auth-muted)]" data-testid="sidebar-plan-invoices">
            {SIDEBAR_TEXT.usageInvoiceUploads}: {formatUsage(invoiceUploadCount, invoiceUploadLimit)}
          </p>
          <div className="auth-plan-progress mt-2 h-2 rounded-full">
            <div
              className="auth-plan-progress-fill h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <Link
            href="/pricing"
            onClick={onNavigate}
            data-testid="sidebar-plan-upgrade-button"
            className="auth-focus-ring mt-3 inline-flex w-full items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/18 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/28"
          >
            {SIDEBAR_TEXT.upgradeCta}
          </Link>
        </article>
      ) : null}

      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
