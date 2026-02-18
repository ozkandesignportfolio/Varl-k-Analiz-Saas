import type { ReactNode } from "react";
import type {
  BillingCycle,
  BillingSubscriptionStatus,
} from "@/features/billing/components/billing-subscription-form";

export type BillingSubscriptionTableRow = {
  id: string;
  maintenance_rule_id: string | null;
  provider_name: string;
  subscription_name: string;
  plan_name: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  currency: string;
  next_billing_date: string | null;
  auto_renew: boolean;
  status: BillingSubscriptionStatus;
  notes: string | null;
  created_at: string;
};

type BillingSubscriptionTableProps = {
  isLoading: boolean;
  subscriptions: BillingSubscriptionTableRow[];
  unpaidInvoiceCount: number;
  formatCurrency: (value: number) => string;
  emptyState?: ReactNode;
};

const statusLabelMap: Record<BillingSubscriptionStatus, string> = {
  active: "Aktif",
  paused: "Duraklatildi",
  cancelled: "Iptal",
};

export function BillingSubscriptionTable({
  isLoading,
  subscriptions,
  unpaidInvoiceCount,
  formatCurrency,
  emptyState,
}: BillingSubscriptionTableProps) {
  return (
    <article className="premium-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Abonelik Listesi</h2>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
          Acik Fatura: {unpaidInvoiceCount}
        </span>
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
      ) : subscriptions.length === 0 ? (
        emptyState ?? <p className="mt-4 text-sm text-slate-300">Henuz abonelik kaydi yok.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {subscriptions.map((subscription) => (
            <article key={subscription.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {subscription.provider_name} - {subscription.subscription_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {subscription.plan_name ? `${subscription.plan_name} - ` : ""}
                    {subscription.billing_cycle === "yearly" ? "Yillik" : "Aylik"} -{" "}
                    {formatCurrency(Number(subscription.amount ?? 0))}
                  </p>
                </div>
                <StatusBadge status={subscription.status} />
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Sonraki tahsilat:{" "}
                {subscription.next_billing_date
                  ? new Date(subscription.next_billing_date).toLocaleDateString("tr-TR")
                  : "-"}
              </p>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: BillingSubscriptionStatus }) {
  const className =
    status === "active"
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
      : status === "paused"
        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
        : "border-rose-300/35 bg-rose-300/10 text-rose-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {statusLabelMap[status]}
    </span>
  );
}