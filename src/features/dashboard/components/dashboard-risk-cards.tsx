export type DashboardPredictionItem = {
  assetId: string;
  assetName: string;
  category: string;
  predictedMaintenanceDate: string | null;
  riskScore: number;
  confidence: number;
  basis: string;
  recommendedAction: string;
  overdueDays: number | null;
};

export type DashboardUpcomingSubscriptionCharge = {
  id: string;
  providerName: string;
  subscriptionName: string;
  nextBillingDate: string;
  amount: number;
  currency: string;
};

export type DashboardMonthlyExpenseWarning = {
  isHigh: boolean;
  total: number;
  threshold: number;
  currency: string;
};

type DashboardPredictionMeta = {
  generatedAt: string;
  model: string;
  warning?: string;
};

type DashboardRiskCardsProps = {
  isLoading: boolean;
  topPredictions: DashboardPredictionItem[];
  predictionMeta: DashboardPredictionMeta | null;
  predictionGeneratedAt: string;
  upcomingSubscriptionCharges: DashboardUpcomingSubscriptionCharge[];
  monthlyExpenseWarning: DashboardMonthlyExpenseWarning;
};

export function DashboardRiskCards({
  isLoading,
  topPredictions,
  predictionMeta,
  predictionGeneratedAt,
  upcomingSubscriptionCharges,
  monthlyExpenseWarning,
}: DashboardRiskCardsProps) {
  return (
    <article className="premium-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">AI Bakım Riskleri</h2>
        {predictionMeta?.model ? <p className="text-xs text-slate-400">Model: {predictionMeta.model}</p> : null}
      </div>
      {predictionGeneratedAt ? (
        <p className="mt-1 text-xs text-slate-400">Üretim zamanı: {predictionGeneratedAt}</p>
      ) : null}
      {predictionMeta?.warning ? (
        <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
          {predictionMeta.warning}
        </p>
      ) : null}
      {upcomingSubscriptionCharges.length > 0 ? (
        <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
            Yaklaşan abonelik tahsilatları
          </p>
          <div className="mt-2 space-y-1.5">
            {upcomingSubscriptionCharges.map((charge) => (
              <div key={charge.id} className="flex items-center justify-between gap-2 text-xs">
                <p className="text-slate-200">
                  {charge.providerName} - {charge.subscriptionName}
                </p>
                <p className="text-slate-300">
                  {new Date(charge.nextBillingDate).toLocaleDateString("tr-TR")} -{" "}
                  {charge.amount.toFixed(2)} {charge.currency}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {monthlyExpenseWarning.isHigh ? (
        <p className="mt-2 rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100">
          Yüksek aylık gider uyarısı: {monthlyExpenseWarning.total.toFixed(2)}{" "}
          {monthlyExpenseWarning.currency} (eşik {monthlyExpenseWarning.threshold.toFixed(2)}{" "}
          {monthlyExpenseWarning.currency})
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : topPredictions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">Risk tahmini bulunmuyor.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {topPredictions.map((item) => (
            <div
              key={`${item.assetId}-${item.predictedMaintenanceDate ?? "none"}-${item.riskScore}`}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.assetName}</p>
                <RiskBadge score={item.riskScore} />
              </div>
              <p className="mt-1 text-xs text-slate-300">{item.recommendedAction}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Güven: %{item.confidence.toFixed(0)}</span>
                {item.overdueDays !== null ? <span>Gecikme: {item.overdueDays} gün</span> : null}
                {item.predictedMaintenanceDate ? (
                  <span>Tarih: {new Date(item.predictedMaintenanceDate).toLocaleDateString("tr-TR")}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function RiskBadge({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  const toneClass =
    normalized >= 70
      ? "border-rose-300/40 bg-rose-300/15 text-rose-100"
      : normalized >= 40
        ? "border-amber-300/40 bg-amber-300/15 text-amber-100"
        : "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
      Risk %{normalized.toFixed(0)}
    </span>
  );
}

