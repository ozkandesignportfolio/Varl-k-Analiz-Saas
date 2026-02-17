"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type AssetDetail = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string;
};

const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [serviceCount, setServiceCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [activeRuleCount, setActiveRuleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!assetId) return;
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

      const [assetRes, serviceRes, documentRes, ruleRes] = await Promise.all([
        supabase
          .from("assets")
          .select(
            "id,name,category,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at",
          )
          .eq("id", assetId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("service_logs")
          .select("id", { count: "exact", head: true })
          .eq("asset_id", assetId)
          .eq("user_id", user.id),
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("asset_id", assetId)
          .eq("user_id", user.id),
        supabase
          .from("maintenance_rules")
          .select("id", { count: "exact", head: true })
          .eq("asset_id", assetId)
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (assetRes.error && isMissingQrCodeError(assetRes.error.message)) {
        const fallbackRes = await supabase
          .from("assets")
          .select("id,name,category,brand,model,purchase_date,warranty_end_date,photo_path,created_at")
          .eq("id", assetId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (fallbackRes.error) {
          setFeedback(fallbackRes.error.message);
        } else if (!fallbackRes.data) {
          setFeedback("Varlık bulunamadı.");
        } else {
          setAsset({ ...(fallbackRes.data as Omit<AssetDetail, "qr_code">), qr_code: null });
        }
      } else if (assetRes.error) {
        setFeedback(assetRes.error.message);
      } else if (!assetRes.data) {
        setFeedback("Varlık bulunamadı.");
      } else {
        setAsset(assetRes.data as AssetDetail);
      }

      if (serviceRes.error) setFeedback(serviceRes.error.message);
      if (documentRes.error) setFeedback(documentRes.error.message);
      if (ruleRes.error) setFeedback(ruleRes.error.message);

      setServiceCount(serviceRes.count ?? 0);
      setDocumentCount(documentRes.count ?? 0);
      setActiveRuleCount(ruleRes.count ?? 0);
      setIsLoading(false);
    };

    void load();
  }, [assetId, supabase]);

  return (
    <AppShell
      badge="Varlık Detayı"
      title={asset?.name ?? "Varlık"}
      subtitle="QR kod ile taranan varlığın detayları burada görüntülenir."
      actions={
        <Link
          href="/assets"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Varlık Listesine Dön
        </Link>
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {isLoading ? (
        <section className="premium-card p-5">
          <p className="text-sm text-slate-300">Yükleniyor...</p>
        </section>
      ) : asset ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="Servis Kaydı" value={String(serviceCount)} />
            <StatCard label="Belge Sayısı" value={String(documentCount)} />
            <StatCard label="Aktif Bakım Kuralı" value={String(activeRuleCount)} />
            <StatCard label="QR Kod" value={asset.qr_code ?? "-"} mono />
          </section>

          <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Temel Bilgiler</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailItem label="Kategori" value={asset.category} />
                <DetailItem label="Marka" value={asset.brand ?? "-"} />
                <DetailItem label="Model" value={asset.model ?? "-"} />
                <DetailItem
                  label="Satın Alma Tarihi"
                  value={asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString("tr-TR") : "-"}
                />
                <DetailItem
                  label="Garanti Bitiş Tarihi"
                  value={
                    asset.warranty_end_date
                      ? new Date(asset.warranty_end_date).toLocaleDateString("tr-TR")
                      : "-"
                  }
                />
                <DetailItem
                  label="Oluşturulma"
                  value={new Date(asset.created_at).toLocaleDateString("tr-TR")}
                />
              </dl>
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Fotoğraf</h2>
              {asset.photo_path ? (
                <PhotoPreview storagePath={asset.photo_path} />
              ) : (
                <p className="mt-4 text-sm text-slate-300">Bu varlık için fotoğraf yüklenmemiş.</p>
              )}
            </article>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold text-white ${mono ? "font-mono text-base" : ""}`}>{value}</p>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function PhotoPreview({ storagePath }: { storagePath: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const signed = await supabase.storage.from("documents-private").createSignedUrl(storagePath, 60 * 5);
      if (signed.error || !signed.data?.signedUrl) {
        setError(signed.error?.message ?? "Fotoğraf URL'i oluşturulamadı.");
        return;
      }
      setUrl(signed.data.signedUrl);
    };
    void load();
  }, [storagePath, supabase]);

  if (error) {
    return <p className="mt-4 text-sm text-rose-200">{error}</p>;
  }

  if (!url) {
    return <p className="mt-4 text-sm text-slate-300">Fotoğraf hazırlanıyor...</p>;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
      <Image
        src={url}
        alt="Varlık fotoğrafı"
        width={1200}
        height={600}
        unoptimized
        className="h-64 w-full object-cover"
      />
    </div>
  );
}
