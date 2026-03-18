"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { listForTimeline as listDocumentsForTimeline } from "@/lib/repos/documents-repo";
import { listForTimeline as listServiceLogsForTimeline } from "@/lib/repos/service-logs-repo";
import { createClient } from "@/lib/supabase/client";

type AssetRow = {
  id: string;
  name: string;
  created_at: string;
};

type ServiceRow = {
  id: string;
  asset_id: string;
  service_type: string;
  service_date: string;
  created_at: string;
};

type DocumentRow = {
  id: string;
  asset_id: string;
  file_name: string;
  uploaded_at: string;
};

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  type: "Varlık" | "Servis" | "Belge";
};

export default function TimelinePage() {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFeedback(userError?.message ?? "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      const [assetRes, serviceRes, docRes] = await Promise.all([
        supabase.from("assets").select("id,name,created_at").eq("user_id", user.id),
        listServiceLogsForTimeline(supabase, { userId: user.id }),
        listDocumentsForTimeline(supabase, { userId: user.id }),
      ]);

      if (assetRes.error) setFeedback(assetRes.error.message);
      if (serviceRes.error) setFeedback(serviceRes.error.message);
      if (docRes.error) setFeedback(docRes.error.message);

      setAssets((assetRes.data ?? []) as AssetRow[]);
      setServices((serviceRes.data ?? []) as ServiceRow[]);
      setDocuments((docRes.data ?? []) as DocumentRow[]);
      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const events = useMemo<TimelineEvent[]>(() => {
    const assetEvents: TimelineEvent[] = assets.map((asset) => ({
      id: `asset-${asset.id}`,
      date: asset.created_at,
      title: `${asset.name} varlığı eklendi`,
      type: "Varlık",
    }));

    const serviceEvents: TimelineEvent[] = services.map((service) => ({
      id: `service-${service.id}`,
      date: service.service_date || service.created_at,
      title: `${assetNameById.get(service.asset_id) ?? "Varlık"} için ${service.service_type} kaydı oluşturuldu`,
      type: "Servis",
    }));

    const documentEvents: TimelineEvent[] = documents.map((doc) => ({
      id: `doc-${doc.id}`,
      date: doc.uploaded_at,
      title: `${assetNameById.get(doc.asset_id) ?? "Varlık"} için ${doc.file_name} yüklendi`,
      type: "Belge",
    }));

    return [...assetEvents, ...serviceEvents, ...documentEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [assets, services, documents, assetNameById]);

  const latestEvents = events.slice(0, 40);

  return (
    <AppShell
      badge="Zaman Akışı"
      title="Olay Akışı"
      subtitle="Bu ekranda varlık, servis ve belge olayları gerçek tarih sırasına göre listelenir."
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Toplam Olay" value={String(events.length)} />
        <SummaryCard label="Servis Olayı" value={String(services.length)} />
        <SummaryCard label="Belge Olayı" value={String(documents.length)} />
      </section>

      <section className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Son Olaylar</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : latestEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Henüz olay bulunmuyor.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {latestEvents.map((event) => (
              <article key={event.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[11px] text-sky-100">
                    {event.type}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(event.date).toLocaleString("tr-TR")}
                </p>
              </article>
            ))}
          </div>
        )}
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
