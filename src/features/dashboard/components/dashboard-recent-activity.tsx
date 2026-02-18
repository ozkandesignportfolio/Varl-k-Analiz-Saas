import Link from "next/link";

type DashboardRecentActivityProps = {
  serviceLogCount: string;
  documentCount: string;
  categoryCount: string;
};

export function DashboardRecentActivity({
  serviceLogCount,
  documentCount,
  categoryCount,
}: DashboardRecentActivityProps) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-lg font-semibold text-white">Özet</h2>
      <div className="mt-4 space-y-2">
        <SummaryRow label="Toplam Servis Kaydı" value={serviceLogCount} />
        <SummaryRow label="Toplam Belge" value={documentCount} />
        <SummaryRow label="Kayıtlı Kategori" value={categoryCount} />
      </div>
      <div className="mt-5 space-y-2">
        <LinkItem href="/assets" label="Varlıkları Yönet" />
        <LinkItem href="/services" label="Servis Kayıtlarını Gör" />
        <LinkItem href="/documents" label="Belgeleri Aç" />
        <LinkItem href="/costs" label="Maliyet Analizine Git" />
      </div>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
    >
      <span>{label}</span>
      <span>{"->"}</span>
    </Link>
  );
}

