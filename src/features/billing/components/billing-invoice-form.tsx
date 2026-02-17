import type { FormEvent } from "react";

export type BillingInvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

type BillingInvoiceSubscriptionOption = {
  id: string;
  provider_name: string;
  subscription_name: string;
};

type BillingInvoiceFormProps = {
  subscriptions: BillingInvoiceSubscriptionOption[];
  selectedSubscriptionId: string;
  onSelectedSubscriptionIdChange: (subscriptionId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isDisabled: boolean;
  inputClassName: string;
  defaultIssuedAt: string;
};

export function BillingInvoiceForm({
  subscriptions,
  selectedSubscriptionId,
  onSelectedSubscriptionIdChange,
  onSubmit,
  isSubmitting,
  isDisabled,
  inputClassName,
  defaultIssuedAt,
}: BillingInvoiceFormProps) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Yeni Fatura Ekle</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Abonelik</span>
          <select
            name="subscriptionId"
            className={inputClassName}
            value={selectedSubscriptionId}
            onChange={(event) => onSelectedSubscriptionIdChange(event.target.value)}
            disabled={subscriptions.length === 0 || isDisabled}
          >
            {subscriptions.length === 0 ? (
              <option value="" className="bg-slate-900">
                Önce abonelik ekleyin
              </option>
            ) : (
              subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id} className="bg-slate-900">
                  {subscription.provider_name} - {subscription.subscription_name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Fatura No (Opsiyonel)</span>
          <input name="invoiceNo" className={inputClassName} placeholder="Örnek: INV-2026-001" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Fatura Tarihi</span>
          <input name="issuedAt" type="date" defaultValue={defaultIssuedAt} className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Vade Tarihi</span>
          <input name="dueDate" type="date" className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Ödeme Tarihi</span>
          <input name="paidAt" type="date" className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Ara Tutar (TL)</span>
          <input name="amount" type="number" min="0" step="0.01" defaultValue="0" className={inputClassName} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Vergi (TL)</span>
          <input
            name="taxAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className={inputClassName}
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Durum</span>
          <select name="status" defaultValue="pending" className={inputClassName}>
            <option value="pending" className="bg-slate-900">
              Beklemede
            </option>
            <option value="paid" className="bg-slate-900">
              Ödendi
            </option>
            <option value="overdue" className="bg-slate-900">
              Gecikmiş
            </option>
            <option value="cancelled" className="bg-slate-900">
              İptal
            </option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isSubmitting || subscriptions.length === 0 || isDisabled}
          className="md:col-span-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Kaydediliyor..." : "Faturayı Ekle"}
        </button>
      </form>
    </article>
  );
}
