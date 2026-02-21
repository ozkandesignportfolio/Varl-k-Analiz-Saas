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
      <h2 className="auth-card-title text-lg font-semibold">Özet</h2>
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
    <div className="auth-list-row flex items-center justify-between rounded-xl px-3 py-2">
      <span className="auth-row-label text-sm">{label}</span>
      <span className="auth-row-value text-sm font-semibold">{value}</span>
    </div>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="auth-list-row auth-list-link auth-focus-ring flex items-center justify-between rounded-xl px-3 py-2 text-sm"
    >
      <span>{label}</span>
      <span>{"->"}</span>
    </Link>
  );
}

