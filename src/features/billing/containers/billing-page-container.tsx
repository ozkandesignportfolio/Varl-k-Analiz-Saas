"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { GuidedEmptyState } from "@/components/shared/guided-empty-state";
import { usePlanContext } from "@/contexts/PlanContext";
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
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type SubscriptionStatus = "active" | "paused" | "cancelled";
type BillingCycle = "monthly" | "yearly";
type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";
type InvoiceReadRow = Partial<BillingInvoiceTableRow>;

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
const billingInvoiceSelectFull =
  "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at";
const billingInvoiceSelectFallback = "id,subscription_id,issued_at,amount,status,created_at";

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

const isMissingColumnError = (errorMessage: string, tableName: string) => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(tableName.toLowerCase()) &&
    normalized.includes("column") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  );
};

const normalizeInvoiceStatus = (value: unknown): InvoiceStatus => {
  if (value === "pending" || value === "paid" || value === "overdue" || value === "cancelled") {
    return value;
  }
  return "pending";
};

const normalizeInvoiceRow = (row: InvoiceReadRow): InvoiceRow => {
  const amount = Number(row.amount ?? 0);
  const taxAmount = Number(row.tax_amount ?? 0);
  const totalAmountRaw = Number(row.total_amount ?? Number.NaN);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeTaxAmount = Number.isFinite(taxAmount) ? taxAmount : 0;
  const createdAt = row.created_at ?? row.issued_at ?? new Date().toISOString();
  const issuedAt = row.issued_at ?? createdAt;

  return {
    id: String(row.id ?? ""),
    subscription_id: String(row.subscription_id ?? ""),
    invoice_no: row.invoice_no ?? null,
    issued_at: issuedAt,
    due_date: row.due_date ?? null,
    paid_at: row.paid_at ?? null,
    amount: safeAmount,
    tax_amount: safeTaxAmount,
    total_amount: Number.isFinite(totalAmountRaw) ? totalAmountRaw : safeAmount + safeTaxAmount,
    status: normalizeInvoiceStatus(row.status),
    created_at: createdAt,
  };
};

export function BillingPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { refreshPlanState } = usePlanContext();

  const [userId, setUserId] = useState("");
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [maintenanceRules, setMaintenanceRules] = useState<MaintenanceRuleOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
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

      let invoiceRes = (await supabase
        .from("billing_invoices")
        .select(billingInvoiceSelectFull)
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })) as {
        data: InvoiceReadRow[] | null;
        error: { message: string } | null;
      };

      if (
        invoiceRes.error &&
        !isMissingTableError(invoiceRes.error.message, "billing_invoices") &&
        isMissingColumnError(invoiceRes.error.message, "billing_invoices")
      ) {
        invoiceRes = (await supabase
          .from("billing_invoices")
          .select(billingInvoiceSelectFallback)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })) as {
          data: InvoiceReadRow[] | null;
          error: { message: string } | null;
        };
      }

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
      setInvoices((invoiceRes.data ?? []).map((row) => normalizeInvoiceRow((row ?? {}) as InvoiceReadRow)));
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
        setHasValidSession(false);
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      setHasValidSession(true);
      setUserId(user.id);
      await fetchBillingData(user.id);
      setIsLoading(false);
    };

    void load();
  }, [fetchBillingData, router, supabase]);

  const ensureAuthUser = () => {
    if (!userId) throw new Error("auth required");
  };

  const subscriptionLabelById = useMemo(() => {
    return new Map(
      subscriptions.map((subscription) => [
        subscription.id,
        `${subscription.provider_name} - ${subscription.subscription_name}`,
      ]),
    );
  }, [subscriptions]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status === "active"),
    [subscriptions],
  );

  const activeSubscriptionCount = activeSubscriptions.length;

  const monthlyEquivalent = useMemo(() => {
    return activeSubscriptions.reduce((sum, subscription) => {
      const amount = Number(subscription.amount ?? 0);
      return sum + (subscription.billing_cycle === "yearly" ? amount / 12 : amount);
    }, 0);
  }, [activeSubscriptions]);

  const nextThirtyDaysCount = useMemo(() => {
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setDate(now.getDate() + 30);

    return activeSubscriptions.filter((subscription) => {
      if (!subscription.next_billing_date) return false;
      const nextDate = new Date(subscription.next_billing_date);
      return nextDate >= now && nextDate <= maxDate;
    }).length;
  }, [activeSubscriptions]);

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
    try {
      ensureAuthUser();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "auth required");
      return;
    }

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

    ensureAuthUser();
    const createResponse = await fetch("/api/billing/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerName,
        subscriptionName,
        planName,
        billingCycle,
        amount,
        nextBillingDate,
        maintenanceRuleId,
        status,
        autoRenew,
        notes,
      }),
    });

    const createPayload = (await createResponse.json().catch(() => null)) as
      | { id?: string; warning?: string; error?: string }
      | null;

    if (!createResponse.ok || !createPayload?.id) {
      setFeedback(createPayload?.error ?? "Abonelik kaydı oluşturulamadı.");
      setIsSavingSubscription(false);
      return;
    }

    form.reset();
    setSelectedSubscriptionId(createPayload.id);
    setFeedback(
      createPayload.warning
        ? `Abonelik başarıyla eklendi. ${createPayload.warning}`
        : "Abonelik başarıyla eklendi.",
    );
    await fetchBillingData(userId);
    await refreshPlanState();
    setIsSavingSubscription(false);
  };

  const onCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invoiceModuleReady) {
      setFeedback(billingSetupHint);
      return;
    }

    try {
      ensureAuthUser();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "auth required");
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

    ensureAuthUser();
    const createResponse = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId,
        invoiceNo,
        issuedAt,
        dueDate,
        paidAt,
        amount,
        taxAmount,
        status,
      }),
    });

    const createPayload = (await createResponse.json().catch(() => null)) as
      | { id?: string; warning?: string; error?: string }
      | null;

    if (!createResponse.ok || !createPayload?.id) {
      const errorMessage = createPayload?.error ?? "Fatura kaydı oluşturulamadı.";
      if (isMissingTableError(errorMessage, "billing_invoices")) {
        setInvoiceModuleReady(false);
        setFeedback(billingSetupHint);
      } else {
        setFeedback(errorMessage);
      }
      setIsSavingInvoice(false);
      return;
    }

    form.reset();
    setFeedback(
      createPayload.warning
        ? `Fatura başarıyla eklendi. ${createPayload.warning}`
        : "Fatura başarıyla eklendi.",
    );
    await fetchBillingData(userId);
    await refreshPlanState();
    setIsSavingInvoice(false);
  };

  const onDeleteInvoice = async (invoice: InvoiceRow) => {
    const ok = window.confirm("Bu fatura kaydını silmek istiyor musunuz?");
    if (!ok) {
      return;
    }

    setDeletingInvoiceId(invoice.id);
    setFeedback("");

    try {
      ensureAuthUser();
      const deleteResponse = await fetch("/api/billing/invoices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id }),
      });

      const deletePayload = (await deleteResponse.json().catch(() => null)) as
        | { ok?: boolean; id?: string; error?: string }
        | null;

      if (!deleteResponse.ok || !deletePayload?.ok) {
        setFeedback(deletePayload?.error ?? "Fatura kaydı silinemedi.");
        return;
      }

      setFeedback("Fatura kaydı silindi.");
      await fetchBillingData(userId);
      await refreshPlanState();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Fatura kaydı silinemedi.");
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const focusCreateSubscriptionForm = useCallback(() => {
    const createForm = document.getElementById("subscription-create-form");
    if (!createForm) return;

    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLInputElement>("input[name='providerName']")?.focus();
  }, []);

  const focusCreateInvoiceForm = useCallback(() => {
    const createForm = document.getElementById("invoice-create-form");
    if (!createForm) return;

    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLSelectElement>("select[name='subscriptionId']")?.focus();
  }, []);

  if (!hasValidSession) {
    return null;
  }

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
          value={String(activeSubscriptionCount)}
        />
        <SummaryCard label="Aylık Eşdeğer Toplam" value={currencyFormatter.format(monthlyEquivalent)} />
        <SummaryCard label="30 Gün İçinde Yenileme" value={String(nextThirtyDaysCount)} />
        <SummaryCard label="Bu Yıl Ödenen Fatura" value={currencyFormatter.format(paidThisYear)} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <div id="subscription-create-form">
          <BillingSubscriptionForm
            mode="create"
            onSubmit={onCreateSubscription}
            isSubmitting={isSavingSubscription}
            inputClassName={inputClassName}
            maintenanceRules={maintenanceRules}
          />
        </div>

        <BillingSubscriptionTable
          isLoading={isLoading}
          subscriptions={subscriptions}
          unpaidInvoiceCount={unpaidInvoiceCount}
          formatCurrency={(value) => currencyFormatter.format(value)}
          emptyState={
            !isLoading ? (
                <GuidedEmptyState
                  title="İlk aboneliği ekle"
                  description="Onboarding adımı olarak önce bir abonelik kaydı oluştur. Sonra bu aboneliğe fatura bağlayabilirsin."
                  primaryAction={{
                    label: "Abonelik formuna git",
                    onClick: focusCreateSubscriptionForm,
                }}
                secondaryAction={
                  maintenanceRules.length > 0
                    ? { label: "Bakım kurallarına git", href: "/maintenance" }
                    : undefined
                }
              />
            ) : undefined
          }
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <div id="invoice-create-form">
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
        </div>

        <BillingInvoiceTable
          isLoading={isLoading}
          invoiceModuleReady={invoiceModuleReady}
          invoices={invoices}
          subscriptionLabelById={subscriptionLabelById}
          formatCurrency={(value) => currencyFormatter.format(value)}
          deletingInvoiceId={deletingInvoiceId}
          onDeleteInvoice={(invoice) => void onDeleteInvoice(invoice)}
          emptyState={
            !isLoading && invoiceModuleReady ? (
              subscriptions.length === 0 ? (
                <GuidedEmptyState
                  title="Fatura için önce abonelik eklenmeli"
                  description="Sistemde abonelik olmadığı için fatura oluşturulamaz. Önce bir abonelik kaydı oluştur."
                  primaryAction={{
                    label: "Abonelik oluştur",
                    onClick: focusCreateSubscriptionForm,
                  }}
                />
              ) : (
                <GuidedEmptyState
                  title="İlk faturanı kaydet"
                  description="Abonelikler oluştu. Şimdi ilk fatura kaydını ekleyerek ödeme takibini başlat."
                  primaryAction={{ label: "Fatura formuna git", onClick: focusCreateInvoiceForm }}
                />
              )
            ) : undefined
          }
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
