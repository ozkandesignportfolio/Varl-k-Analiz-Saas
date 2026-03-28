import type { ReactNode } from "react";
import type { BillingInvoiceStatus } from "@/features/billing/components/billing-invoice-form";

export type BillingInvoiceTableRow = {
  id: string;
  subscription_id: string;
  invoice_no: string | null;
  issued_at: string;
  due_date: string | null;
  paid_at: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: BillingInvoiceStatus;
  created_at: string;
};

type BillingInvoiceTableProps = {
  isLoading: boolean;
  invoiceModuleReady: boolean;
  invoices: BillingInvoiceTableRow[];
  subscriptionLabelById: Map<string, string>;
  formatCurrency: (value: number) => string;
  deletingInvoiceId?: string | null;
  onDeleteInvoice?: (invoice: BillingInvoiceTableRow) => void;
  emptyState?: ReactNode;
};

const invoiceStatusLabelMap: Record<BillingInvoiceStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
};

export function BillingInvoiceTable({
  isLoading,
  invoiceModuleReady,
  invoices,
  subscriptionLabelById,
  formatCurrency,
  deletingInvoiceId,
  onDeleteInvoice,
  emptyState,
}: BillingInvoiceTableProps) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Fatura Geçmişi</h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : !invoiceModuleReady ? (
        <p className="mt-4 text-sm text-slate-300">Fatura tablosu hazır olduğunda geçmiş burada listelenecek.</p>
      ) : invoices.length === 0 ? (
        emptyState ?? <p className="mt-4 text-sm text-slate-300">Henüz fatura kaydı yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Abonelik</th>
                <th className="px-3 py-2">Toplam</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 16).map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/10 text-slate-100">
                  <td className="px-3 py-3">{new Date(invoice.issued_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-3 py-3">
                    {subscriptionLabelById.get(invoice.subscription_id) ?? "Silinmiş abonelik"}
                  </td>
                  <td className="px-3 py-3">{formatCurrency(Number(invoice.total_amount ?? 0))}</td>
                  <td className="px-3 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-3 py-3">
                    {onDeleteInvoice ? (
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(invoice)}
                        disabled={deletingInvoiceId === invoice.id}
                        className="rounded-full border border-rose-300/35 bg-rose-300/10 px-2.5 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingInvoiceId === invoice.id ? "Siliniyor..." : "Sil"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function InvoiceStatusBadge({ status }: { status: BillingInvoiceStatus }) {
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
