import type { FormEvent } from "react";

export type BillingSubscriptionStatus = "active" | "paused" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

type BillingSubscriptionFormValue = {
  provider_name: string;
  subscription_name: string;
  plan_name: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  next_billing_date: string | null;
  auto_renew: boolean;
  status: BillingSubscriptionStatus;
  notes: string | null;
};

type BillingSubscriptionFormBaseProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  inputClassName: string;
};

type CreateBillingSubscriptionFormProps = BillingSubscriptionFormBaseProps & {
  mode: "create";
};

type EditBillingSubscriptionFormProps = BillingSubscriptionFormBaseProps & {
  mode: "edit";
  subscription: BillingSubscriptionFormValue;
  onCancel: () => void;
};

type BillingSubscriptionFormProps =
  | CreateBillingSubscriptionFormProps
  | EditBillingSubscriptionFormProps;

export function BillingSubscriptionForm(props: BillingSubscriptionFormProps) {
  if (props.mode === "create") {
    const { onSubmit, isSubmitting, inputClassName } = props;

    return (
      <article className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Yeni Abonelik Ekle</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Sağlayıcı</span>
            <input name="providerName" className={inputClassName} required placeholder="Örnek: Spotify" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Abonelik Adı</span>
            <input
              name="subscriptionName"
              className={inputClassName}
              required
              placeholder="Örnek: Aile Planı"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Plan (Opsiyonel)</span>
            <input name="planName" className={inputClassName} placeholder="Örnek: Premium" />
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

  const { onSubmit, isSubmitting, inputClassName, subscription, onCancel } = props;

  return (
    <section className="premium-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Aboneliği Güncelle</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
        >
          Vazgeç
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Sağlayıcı</span>
          <input
            name="providerName"
            className={inputClassName}
            required
            defaultValue={subscription.provider_name}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Abonelik Adı</span>
          <input
            name="subscriptionName"
            className={inputClassName}
            required
            defaultValue={subscription.subscription_name}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Plan (Opsiyonel)</span>
          <input name="planName" className={inputClassName} defaultValue={subscription.plan_name ?? ""} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Döngü</span>
          <select name="billingCycle" className={inputClassName} defaultValue={subscription.billing_cycle}>
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
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(subscription.amount)}
            className={inputClassName}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Sonraki Tahsilat</span>
          <input
            name="nextBillingDate"
            type="date"
            defaultValue={subscription.next_billing_date ?? ""}
            className={inputClassName}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Durum</span>
          <select name="status" className={inputClassName} defaultValue={subscription.status}>
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
          <select
            name="autoRenew"
            className={inputClassName}
            defaultValue={subscription.auto_renew ? "true" : "false"}
          >
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
          <textarea
            name="notes"
            rows={3}
            className={inputClassName}
            placeholder="Opsiyonel not"
            defaultValue={subscription.notes ?? ""}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Güncelleniyor..." : "Güncellemeyi Kaydet"}
        </button>
      </form>
    </section>
  );
}
