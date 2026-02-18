"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  ExpenseForm,
  type ExpenseFormAssetOption,
} from "@/features/expenses/components/expense-form";
import {
  ExpenseTable,
  type ExpenseTableRow,
} from "@/features/expenses/components/expense-table";
import {
  safeExpensesReadQuery,
  safeExpensesWriteQuery,
  type ExpensesTableWarning,
} from "@/features/expenses/lib/expenses-query-guard";
import { listIdName } from "@/lib/repos/assets-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetOption = ExpenseFormAssetOption;
type ExpenseRow = ExpenseTableRow;
type ExpenseReadRow = {
  id: string;
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const isMissingColumnError = (errorMessage: string, tableName: string) => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(tableName.toLowerCase()) &&
    normalized.includes("column") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  );
};

export function ExpensesPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [tableWarning, setTableWarning] = useState<ExpensesTableWarning | null>(null);
  const [hasValidSession, setHasValidSession] = useState(true);

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listIdName(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      setAssets((data ?? []) as AssetOption[]);
    },
    [supabase],
  );

  const fetchExpenses = useCallback(
    async (currentUserId: string) => {
      const expensesQueryResult = await supabase
        .from("expenses")
        .select("id,asset_id,amount,category,note,created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      const result = await safeExpensesReadQuery<ExpenseReadRow>(
        Promise.resolve(expensesQueryResult),
        "expenses-page.fetch",
      );

      if (result.warning) {
        setTableWarning(result.warning);
        setFeedback("");
        setExpenses([]);
        return;
      }

      setTableWarning(null);

      if (result.error) {
        setFeedback(result.error.message);
        return;
      }

      const normalizedExpenses: ExpenseRow[] = (result.data ?? []).map((expense) => {
        const category = (expense.category ?? "").trim();
        const expenseDate = (expense.created_at ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        return {
          id: expense.id,
          asset_id: expense.asset_id ?? null,
          title: category || "Gider",
          category: category || "Diger",
          amount: Number(expense.amount ?? 0),
          currency: "TRY",
          expense_date: expenseDate,
          notes: expense.note ?? null,
          created_at: expense.created_at,
        };
      });

      setExpenses(normalizedExpenses);
    },
    [supabase],
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
      await Promise.all([fetchAssets(user.id), fetchExpenses(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchExpenses, router, supabase]);

  const ensureAuthUser = () => {
    if (!userId) throw new Error("auth required");
  };

  const onCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");

    try {
      ensureAuthUser();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "auth required");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const amount = Number(String(formData.get("amount") ?? "").trim());
    const currency = String(formData.get("currency") ?? "TRY").trim().toUpperCase();
    const expenseDate = String(formData.get("expenseDate") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!title || !category || !expenseDate) {
      setFeedback("Baslik, kategori ve tarih zorunludur.");
      return;
    }

    if (Number.isNaN(amount) || amount < 0) {
      setFeedback("Tutar gecersiz.");
      return;
    }

    setIsSaving(true);

    ensureAuthUser();
    let expenseWriteResult = await supabase.from("expenses").insert({
      user_id: userId,
      asset_id: selectedAssetId || null,
      title,
      category,
      amount,
      currency,
      expense_date: expenseDate,
      notes: notes || null,
    });

    if (
      expenseWriteResult.error &&
      isMissingColumnError(expenseWriteResult.error.message, "expenses")
    ) {
      expenseWriteResult = await supabase.from("expenses").insert({
        user_id: userId,
        asset_id: selectedAssetId || null,
        amount,
        category,
        note: notes || title || null,
      });
    }

    const result = await safeExpensesWriteQuery(
      Promise.resolve(expenseWriteResult),
      "expenses-page.create",
    );

    if (result.warning) {
      setTableWarning(result.warning);
      setExpenses([]);
      setFeedback("Gider tablosu bulunamadi. Kayit eklenemedi.");
      setIsSaving(false);
      return;
    }

    setTableWarning(null);

    if (result.error) {
      setFeedback(result.error.message);
      setIsSaving(false);
      return;
    }

    form.reset();
    setSelectedAssetId("");
    setFeedback("Gider kaydi eklendi.");
    await fetchExpenses(userId);
    setIsSaving(false);
  };

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const categoryCount = useMemo(
    () => new Set(expenses.map((expense) => expense.category)).size,
    [expenses],
  );

  const linkedAssetCount = useMemo(
    () => expenses.filter((expense) => Boolean(expense.asset_id)).length,
    [expenses],
  );

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell
      badge="Gider Takibi"
      title="Giderler"
      subtitle="Giderlerinizi kaydedin ve varlik bazli takip edin."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Toplam Kayit" value={String(expenses.length)} />
        <SummaryCard label="Varlik Baglantili" value={String(linkedAssetCount)} />
        <SummaryCard label="Kategori" value={String(categoryCount)} />
      </section>

      <ExpenseForm
        assets={assets}
        selectedAssetId={selectedAssetId}
        onSelectedAssetIdChange={setSelectedAssetId}
        onSubmit={onCreateExpense}
        isSubmitting={isSaving}
        inputClassName={inputClassName}
      />

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      {tableWarning ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Gider tablosu su an erisilebilir degil. Bos liste gosteriliyor. ({tableWarning.code})
        </p>
      ) : null}

      <ExpenseTable isLoading={isLoading} expenses={expenses} assetNameById={assetNameById} />
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

