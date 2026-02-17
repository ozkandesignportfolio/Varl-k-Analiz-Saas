"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type SubscriptionStatus = "active" | "paused" | "cancelled";
type BillingCycle = "monthly" | "yearly";
type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

type SubscriptionRow = {
  id: string;
  provider_name: string;
  subscription_name: string;
  plan_name: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  currency: string;
  next_billing_date: string | null;
  auto_renew: boolean;
  status: SubscriptionStatus;
  notes: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  subscription_id: string;
  invoice_no: string | null;
  issued_at: string;
  due_date: string | null;
  paid_at: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  created_at: string;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

const statusLabelMap: Record<SubscriptionStatus, string> = {
  active: "Aktif",
  paused: "Duraklatıldı",
  cancelled: "İptal",
};

const invoiceStatusLabelMap: Record<InvoiceStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
};

const billingSetupHint =
  "Fatura tabloları veritabanında bulunamadı. 'supabase/migrations/20260217090000_repair_billing_invoices.sql' migrasyonunu çalıştırıp Supabase schema cache yenilemesi yapın.";

const toOptionalText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isMissingTableError = (errorMessage: string, tableName: string) => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(`public.${tableName}`.toLowerCase()) &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
};

export default function BillingPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");
  const [invoiceModuleReady, setInvoiceModuleReady] = useState(true);

  const fetchBillingData = useCallback(
    async (currentUserId: string) => {
      const subscriptionRes = await supabase
        .from("billing_subscriptions")
        .select(
          "id,provider_name,subscription_name,plan_name,billing_cycle,amount,currency,next_billing_date,auto_renew,status,notes,created_at",
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (subscriptionRes.error) {
        setFeedback(subscriptionRes.error.message);
      }

      const nextSubscriptions = (subscriptionRes.data ?? []) as SubscriptionRow[];
      setSubscriptions(nextSubscriptions);

      if (!selectedSubscriptionId && nextSubscriptions.length > 0) {
        setSelectedSubscriptionId(nextSubscriptions[0].id);
      }

      const invoiceRes = await supabase
        .from("billing_invoices")
        .select(
          "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at",
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (invoiceRes.error) {
        if (isMissingTableError(invoiceRes.error.message, "billing_invoices")) {
          setInvoiceModuleReady(false);
          setInvoices([]);
          setFeedback(billingSetupHint);
          return;
        }
        setFeedback(invoiceRes.error.message);
      }

      setInvoiceModuleReady(true);
      setInvoices((invoiceRes.data ?? []) as InvoiceRow[]);
    },
    [selectedSubscriptionId, supabase],
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFeedback("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      await fetchBillingData(user.id);
      setIsLoading(false);
    };

    void load();
  }, [fetchBillingData, supabase]);

  const subscriptionLabelById = useMemo(() => {
    return new Map(
      subscriptions.map((subscription) => [
        subscription.id,
        `${subscription.provider_name} - ${subscription.subscription_name}`,
      ]),
    );
  }, [subscriptions]);

  const monthlyEquivalent = useMemo(() => {
    return subscriptions
      .filter((subscription) => subscription.status === "active")
      .reduce((sum, subscription) => {
        const amount = Number(subscription.amount ?? 0);
        return sum + (subscription.billing_cycle === "yearly" ? amount / 12 : amount);
      }, 0);
  }, [subscriptions]);

  const nextThirtyDaysCount = useMemo(() => {
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setDate(now.getDate() + 30);

    return subscriptions.filter((subscription) => {
      if (subscription.status !== "active" || !subscription.next_billing_date) return false;
      const nextDate = new Date(subscription.next_billing_date);
      return nextDate >= now && nextDate <= maxDate;
    }).length;
  }, [subscriptions]);

  const unpaidInvoiceCount = useMemo(
    () => invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "overdue").length,
    [invoices],
  );

  const paidThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return invoices
      .filter((invoice) => {
        if (invoice.status !== "paid") return false;
        if (!invoice.paid_at) return false;
        return new Date(invoice.paid_at).getFullYear() === currentYear;
      })
      .reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  }, [invoices]);

  const onCreateSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    setFeedback("");
    setIsSavingSubscription(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const providerName = String(formData.get("providerName") ?? "").trim();
    const subscriptionName = String(formData.get("subscriptionName") ?? "").trim();
    const planName = toOptionalText(formData.get("planName"));
    const billingCycle = String(formData.get("billingCycle") ?? "monthly").trim() as BillingCycle;
    const amount = Number(formData.get("amount") ?? 0);
    const nextBillingDate = toOptionalText(formData.get("nextBillingDate"));
    const status = String(formData.get("status") ?? "active").trim() as SubscriptionStatus;
    const autoRenew = String(formData.get("autoRenew") ?? "true") === "true";
    const notes = toOptionalText(formData.get("notes"));

    if (!providerName || !subscriptionName) {
      setFeedback("Sağlayıcı ve abonelik adı zorunludur.");
      setIsSavingSubscription(false);
      return;
    }

    if (Number.isNaN(amount) || amount < 0) {
      setFeedback("Abonelik tutarı geçersiz.");
      setIsSavingSubscription(false);
      return;
    }

    const { data, error } = await supabase
      .from("billing_subscriptions")
      .insert({
        user_id: userId,
        provider_name: providerName,
        subscription_name: subscriptionName,
        plan_name: planName,
        billing_cycle: billingCycle,
        amount,
        currency: "TRY",
        next_billing_date: nextBillingDate,
        status,
        auto_renew: autoRenew,
        notes,
      })
      .select("id")
      .single();

    if (error) {
      setFeedback(error.message);
      setIsSavingSubscription(false);
      return;
    }

    form.reset();
    if (data?.id) {
      setSelectedSubscriptionId(data.id);
    }
    setFeedback("Abonelik başarıyla eklendi.");
    await fetchBillingData(userId);
    setIsSavingSubscription(false);
  };

  const onCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !invoiceModuleReady) {
      setFeedback(billingSetupHint);
      return;
    }

    setFeedback("");
    setIsSavingInvoice(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const subscriptionId = String(formData.get("subscriptionId") ?? selectedSubscriptionId).trim();
    const invoiceNo = toOptionalText(formData.get("invoiceNo"));
    const issuedAt = String(formData.get("issuedAt") ?? toDateInput(new Date())).trim();
    const dueDate = toOptionalText(formData.get("dueDate"));
    const paidAtRaw = toOptionalText(formData.get("paidAt"));
    const amount = Number(formData.get("amount") ?? 0);
    const taxAmount = Number(formData.get("taxAmount") ?? 0);
    const status = String(formData.get("status") ?? "pending").trim() as InvoiceStatus;

    if (!subscriptionId) {
      setFeedback("Fatura için bir abonelik seçmeniz gerekir.");
      setIsSavingInvoice(false);
      return;
    }

    if (Number.isNaN(amount) || amount < 0 || Number.isNaN(taxAmount) || taxAmount < 0) {
      setFeedback("Fatura tutarı veya vergi tutarı geçersiz.");
      setIsSavingInvoice(false);
      return;
    }

    const paidAt = status === "paid" ? paidAtRaw ?? toDateInput(new Date()) : null;
    const totalAmount = amount + taxAmount;

    const { error } = await supabase.from("billing_invoices").insert({
      user_id: userId,
      subscription_id: subscriptionId,
      invoice_no: invoiceNo,
      issued_at: issuedAt,
      due_date: dueDate,
      paid_at: paidAt,
      amount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status,
    });

    if (error) {
      if (isMissingTableError(error.message, "billing_invoices")) {
        setInvoiceModuleReady(false);
        setFeedback(billingSetupHint);
      } else {
        setFeedback(error.message);
      }
      setIsSavingInvoice(false);
      return;
    }

    form.reset();
    setFeedback("Fatura başarıyla eklendi.");
    await fetchBillingData(userId);
    setIsSavingInvoice(false);
  };

  return (
    <AppShell
      badge="Abonelik ve Fatura"
      title="Abonelik Takibi"
      subtitle="Fatura aboneliklerinizi, yenileme tarihlerini ve ödeme durumlarını tek panelden takip edin."
    >
      {feedback ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {feedback}
        </p>
      ) : null}

      {!invoiceModuleReady ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          Fatura modülü pasif: veritabanında <strong>billing_invoices</strong> tablosu henüz hazır değil.
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Aktif Abonelik"
          value={String(subscriptions.filter((item) => item.status === "active").length)}
        />
        <SummaryCard label="Aylık Eşdeğer Toplam" value={currencyFormatter.format(monthlyEquivalent)} />
        <SummaryCard label="30 Gün İçinde Yenileme" value={String(nextThirtyDaysCount)} />
        <SummaryCard label="Bu Yıl Ödenen Fatura" value={currencyFormatter.format(paidThisYear)} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Yeni Abonelik Ekle</h2>
          <form onSubmit={onCreateSubscription} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sağlayıcı</span>
              <input name="providerName" className={inputClassName} required placeholder="Örnek: Spotify" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Abonelik Adı</span>
              <input name="subscriptionName" className={inputClassName} required placeholder="Örnek: Aile Planı" />
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
              disabled={isSavingSubscription}
              className="md:col-span-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSavingSubscription ? "Kaydediliyor..." : "Aboneliği Ekle"}
            </button>
          </form>
        </article>

        <article className="premium-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-white">Abonelik Listesi</h2>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
              Açık Fatura: {unpaidInvoiceCount}
            </span>
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : subscriptions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Henüz abonelik kaydı yok.</p>
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
                        {subscription.plan_name ? `${subscription.plan_name} · ` : ""}
                        {subscription.billing_cycle === "yearly" ? "Yıllık" : "Aylık"} ·{" "}
                        {currencyFormatter.format(Number(subscription.amount ?? 0))}
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
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Yeni Fatura Ekle</h2>
          <form onSubmit={onCreateInvoice} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Abonelik</span>
              <select
                name="subscriptionId"
                className={inputClassName}
                value={selectedSubscriptionId}
                onChange={(event) => setSelectedSubscriptionId(event.target.value)}
                disabled={subscriptions.length === 0 || !invoiceModuleReady}
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
              <input name="issuedAt" type="date" defaultValue={toDateInput(new Date())} className={inputClassName} />
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
              <input name="taxAmount" type="number" min="0" step="0.01" defaultValue="0" className={inputClassName} />
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
              disabled={isSavingInvoice || subscriptions.length === 0 || !invoiceModuleReady}
              className="md:col-span-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSavingInvoice ? "Kaydediliyor..." : "Faturayı Ekle"}
            </button>
          </form>
        </article>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Fatura Geçmişi</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : !invoiceModuleReady ? (
            <p className="mt-4 text-sm text-slate-300">Fatura tablosu hazır olduğunda geçmiş burada listelenecek.</p>
          ) : invoices.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Henüz fatura kaydı yok.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">Abonelik</th>
                    <th className="px-3 py-2">Toplam</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 16).map((invoice) => (
                    <tr key={invoice.id} className="border-b border-white/10 text-slate-100">
                      <td className="px-3 py-3">{new Date(invoice.issued_at).toLocaleDateString("tr-TR")}</td>
                      <td className="px-3 py-3">
                        {subscriptionLabelById.get(invoice.subscription_id) ?? "Silinmiş abonelik"}
                      </td>
                      <td className="px-3 py-3">{currencyFormatter.format(Number(invoice.total_amount ?? 0))}</td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
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

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const className =
    status === "paid"
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
      : status === "overdue"
        ? "border-rose-300/35 bg-rose-300/10 text-rose-100"
        : status === "cancelled"
          ? "border-white/25 bg-white/10 text-slate-200"
          : "border-amber-300/35 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {invoiceStatusLabelMap[status]}
    </span>
  );
}
