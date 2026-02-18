"use client";

export type ExpenseTableRow = {
  id: string;
  asset_id: string | null;
  title: string;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  notes: string | null;
  created_at: string;
};

type ExpenseTableProps = {
  isLoading: boolean;
  expenses: ExpenseTableRow[];
  assetNameById: Map<string, string>;
};

export function ExpenseTable({ isLoading, expenses, assetNameById }: ExpenseTableProps) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Giderler</h2>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : expenses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">Henüz gider kaydı yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Baslik</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Varlık</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Not</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-white/10 text-slate-100">
                  <td className="px-3 py-3">
                    {new Date(expense.expense_date).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-3 py-3">{expense.title}</td>
                  <td className="px-3 py-3">{expense.category}</td>
                  <td className="px-3 py-3">
                    {expense.asset_id ? (assetNameById.get(expense.asset_id) ?? "-") : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {Number(expense.amount).toFixed(2)} {expense.currency}
                  </td>
                  <td className="px-3 py-3">{expense.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


