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
        <h2 className="auth-card-title text-lg font-semibold">AI Bakım Riskleri</h2>
        {predictionMeta?.model ? <p className="auth-meta-text text-xs">Model: {predictionMeta.model}</p> : null}
      </div>
      {predictionGeneratedAt ? (
        <p className="auth-meta-text mt-1 text-xs">Üretim zamanı: {predictionGeneratedAt}</p>
      ) : null}
      {predictionMeta?.warning ? (
        <p className="auth-alert auth-alert-warning mt-2 rounded-lg px-2 py-1 text-xs">
          {predictionMeta.warning}
        </p>
      ) : null}
      {upcomingSubscriptionCharges.length > 0 ? (
        <div className="auth-subtle-block mt-3 rounded-lg p-3">
          <p className="auth-row-label text-xs font-semibold uppercase tracking-[0.15em]">
            Yaklaşan abonelik tahsilatları
          </p>
          <div className="mt-2 space-y-1.5">
            {upcomingSubscriptionCharges.map((charge) => (
              <div key={charge.id} className="flex items-center justify-between gap-2 text-xs">
                <p className="auth-row-value">
                  {charge.providerName} - {charge.subscriptionName}
                </p>
                <p className="auth-row-label">
                  {new Date(charge.nextBillingDate).toLocaleDateString("tr-TR")} -{" "}
                  {charge.amount.toFixed(2)} {charge.currency}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {monthlyExpenseWarning.isHigh ? (
        <p className="auth-alert auth-alert-danger mt-2 rounded-lg px-2 py-1 text-xs">
          Yüksek aylık gider uyarısı: {monthlyExpenseWarning.total.toFixed(2)}{" "}
          {monthlyExpenseWarning.currency} (eşik {monthlyExpenseWarning.threshold.toFixed(2)}{" "}
          {monthlyExpenseWarning.currency})
        </p>
      ) : null}

      {isLoading ? (
        <p className="auth-card-subtitle mt-4 text-sm">Yükleniyor...</p>
      ) : topPredictions.length === 0 ? (
        <p className="auth-card-subtitle mt-4 text-sm">Risk tahmini bulunmuyor.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {topPredictions.map((item) => (
            <div
              key={`${item.assetId}-${item.predictedMaintenanceDate ?? "none"}-${item.riskScore}`}
              className="auth-subtle-block rounded-xl px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="auth-row-value text-sm font-medium">{item.assetName}</p>
                <RiskBadge score={item.riskScore} />
              </div>
              <p className="auth-card-subtitle mt-1 text-xs">{item.recommendedAction}</p>
              <div className="auth-meta-text mt-1 flex flex-wrap items-center gap-3 text-xs">
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
      ? "auth-risk-pill-high"
      : normalized >= 40
        ? "auth-risk-pill-medium"
        : "auth-risk-pill-low";

  return (
    <span className={`auth-risk-pill rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
      Risk %{normalized.toFixed(0)}
    </span>
  );
}

