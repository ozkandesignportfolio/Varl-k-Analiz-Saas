"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BillingInvoiceForm } from "@/features/billing/components/billing-invoice-form";
import {
  BillingInvoiceTable,
  type BillingInvoiceTableRow,
} from "@/features/billing/components/billing-invoice-table";
import {
  BillingSubscriptionForm,
  type BillingSubscriptionFormRuleOption,
} from "@/features/billing/components/billing-subscription-form";
import {
  BillingSubscriptionTable,
  type BillingSubscriptionTableRow,
} from "@/features/billing/components/billing-subscription-table";
import { createClient } from "@/lib/supabase/client";

type SubscriptionStatus = "active" | "paused" | "cancelled";
type BillingCycle = "monthly" | "yearly";
type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

type SubscriptionRow = BillingSubscriptionTableRow;

type InvoiceRow = BillingInvoiceTableRow;
type MaintenanceRuleOption = BillingSubscriptionFormRuleOption;

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

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

export function BillingPageContainer() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [maintenanceRules, setMaintenanceRules] = useState<MaintenanceRuleOption[]>([]);
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
          "id,maintenance_rule_id,provider_name,subscription_name,plan_name,billing_cycle,amount,currency,next_billing_date,auto_renew,status,notes,created_at",
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

      const rulesRes = await supabase
        .from("maintenance_rules")
        .select("id,title")
        .eq("user_id", currentUserId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (rulesRes.error) {
        setFeedback(rulesRes.error.message);
      }

      setMaintenanceRules((rulesRes.data ?? []) as MaintenanceRuleOption[]);

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
    const maintenanceRuleId = toOptionalText(formData.get("maintenanceRuleId"));
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
        maintenance_rule_id: maintenanceRuleId,
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
        <BillingSubscriptionForm
          mode="create"
          onSubmit={onCreateSubscription}
          isSubmitting={isSavingSubscription}
          inputClassName={inputClassName}
          maintenanceRules={maintenanceRules}
        />

        <BillingSubscriptionTable
          isLoading={isLoading}
          subscriptions={subscriptions}
          unpaidInvoiceCount={unpaidInvoiceCount}
          formatCurrency={(value) => currencyFormatter.format(value)}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <BillingInvoiceForm
          subscriptions={subscriptions}
          selectedSubscriptionId={selectedSubscriptionId}
          onSelectedSubscriptionIdChange={setSelectedSubscriptionId}
          onSubmit={onCreateInvoice}
          isSubmitting={isSavingInvoice}
          isDisabled={!invoiceModuleReady}
          inputClassName={inputClassName}
          defaultIssuedAt={toDateInput(new Date())}
        />

        <BillingInvoiceTable
          isLoading={isLoading}
          invoiceModuleReady={invoiceModuleReady}
          invoices={invoices}
          subscriptionLabelById={subscriptionLabelById}
          formatCurrency={(value) => currencyFormatter.format(value)}
        />
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
