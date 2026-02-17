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
import { listIdName } from "@/lib/repos/assets-repo";
import { createClient } from "@/lib/supabase/client";

type AssetOption = ExpenseFormAssetOption;
type ExpenseRow = ExpenseTableRow;

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export function ExpensesPageContainer() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

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
      const { data, error } = await supabase
        .from("expenses")
        .select("id,asset_id,title,category,amount,currency,expense_date,notes,created_at")
        .eq("user_id", currentUserId)
        .order("expense_date", { ascending: false });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setExpenses((data ?? []) as ExpenseRow[]);
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
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      await Promise.all([fetchAssets(user.id), fetchExpenses(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchExpenses, router, supabase]);

  const onCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");

    if (!userId) {
      setFeedback("Kullanici bilgisi bulunamadi.");
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

    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      asset_id: selectedAssetId || null,
      title,
      category,
      amount,
      currency,
      expense_date: expenseDate,
      notes: notes || null,
    });

    if (error) {
      setFeedback(error.message);
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
