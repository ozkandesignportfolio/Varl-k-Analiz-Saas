import type { BillingSubscriptionCreateProps } from "@/features/billing/components/billing-subscription-form";

export function BillingSubscriptionCreateForm({
  onSubmit,
  isSubmitting,
  inputClassName,
  maintenanceRules,
}: BillingSubscriptionCreateProps) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Yeni Abonelik Ekle</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Sağlayıcı</span>
          <input
            name="providerName"
            className={inputClassName}
            required
            placeholder="Örnek: Fiber İnternet Aboneliği"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Abonelik Adı</span>
          <input
            name="subscriptionName"
            className={inputClassName}
            required
            placeholder="Örnek: GSM Kurumsal Hat"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Plan (Opsiyonel)</span>
          <input name="planName" className={inputClassName} placeholder="Örnek: Yıllık Ekip Lisansı" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Bakım Kuralı (Opsiyonel)</span>
          <select name="maintenanceRuleId" className={inputClassName} defaultValue="">
            <option value="" className="bg-slate-900">
              Kural bağlama
            </option>
            {maintenanceRules.map((rule) => (
              <option key={rule.id} value={rule.id} className="bg-slate-900">
                {rule.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Döngü</span>
          <select name="billingCycle" className={inputClassName} defaultValue="monthly">
            <option value="monthly" className="bg-slate-900">
              Aylık
            </option>
            <option value="yearly" className="bg-slate-900">
              Yıllık
            </option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Tutar (TL)</span>
          <input name="amount" type="number" min="0" step="0.01" defaultValue="0" className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Sonraki Tahsilat</span>
          <input name="nextBillingDate" type="date" className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Durum</span>
          <select name="status" className={inputClassName} defaultValue="active">
            <option value="active" className="bg-slate-900">
              Aktif
            </option>
            <option value="paused" className="bg-slate-900">
              Duraklatıldı
            </option>
            <option value="cancelled" className="bg-slate-900">
              İptal
            </option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Otomatik Yenileme</span>
          <select name="autoRenew" className={inputClassName} defaultValue="true">
            <option value="true" className="bg-slate-900">
              Açık
            </option>
            <option value="false" className="bg-slate-900">
              Kapalı
            </option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Not</span>
          <textarea name="notes" rows={3} className={inputClassName} placeholder="Opsiyonel not" />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Kaydediliyor..." : "Aboneliği Ekle"}
        </button>
      </form>
    </article>
  );
}

