"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/app-shell";
import { ASSET_MEDIA_BUCKET } from "@/lib/assets/media-limits";
import { buildAssetQrPayload } from "@/lib/assets/qr-payload";
import { createClient } from "@/lib/supabase/client";

type AssetDetail = {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string;
};

type AssetMediaRow = {
  id: string;
  type: "image" | "video" | "audio";
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type AssetMediaWithUrl = AssetMediaRow & {
  signed_url: string;
};

const LEGACY_PHOTO_BUCKET = "documents-private";
const PHOTO_BUCKET_FALLBACK_ORDER = [ASSET_MEDIA_BUCKET, LEGACY_PHOTO_BUCKET] as const;

const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

const isMissingAssetMediaError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
};

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [serviceCount, setServiceCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [activeRuleCount, setActiveRuleCount] = useState(0);
  const [mediaItems, setMediaItems] = useState<AssetMediaWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [qrPayload, setQrPayload] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!assetId) return;
      setIsLoading(true);
      setFeedback("");
      setMediaItems([]);

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
            "id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at",
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
          .select(
            "id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,created_at",
          )
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

      const mediaRes = await supabase
        .from("asset_media")
        .select("id,type,storage_path,mime_type,size_bytes,created_at")
        .eq("asset_id", assetId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (mediaRes.error && !isMissingAssetMediaError(mediaRes.error.message)) {
        setFeedback(mediaRes.error.message);
      }

      const mediaRows = (mediaRes.data ?? []) as AssetMediaRow[];
      const signedMediaEntries = await Promise.all(
        mediaRows.map(async (row) => {
          const signed = await supabase.storage.from(ASSET_MEDIA_BUCKET).createSignedUrl(row.storage_path, 60 * 5);
          if (signed.error || !signed.data?.signedUrl) {
            return null;
          }
          return {
            ...row,
            signed_url: signed.data.signedUrl,
          } as AssetMediaWithUrl;
        }),
      );

      const validMedia = signedMediaEntries.filter((item): item is AssetMediaWithUrl => Boolean(item));

      if (validMedia.every((item) => item.type !== "image") && assetRes.data?.photo_path) {
        let fallbackSignedUrl: string | null = null;
        for (const bucket of PHOTO_BUCKET_FALLBACK_ORDER) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(assetRes.data.photo_path, 60 * 5);
          if (!signed.error && signed.data?.signedUrl) {
            fallbackSignedUrl = signed.data.signedUrl;
            break;
          }
        }

        if (fallbackSignedUrl) {
          validMedia.unshift({
            id: `legacy-${assetRes.data.id}`,
            type: "image",
            storage_path: assetRes.data.photo_path,
            mime_type: "image/jpeg",
            size_bytes: 0,
            created_at: assetRes.data.created_at,
            signed_url: fallbackSignedUrl,
          });
        }
      }

      setMediaItems(validMedia);
      setIsLoading(false);
    };

    void load();
  }, [assetId, supabase]);

  const imageItems = mediaItems.filter((item) => item.type === "image");
  const videoItems = mediaItems.filter((item) => item.type === "video");
  const audioItems = mediaItems.filter((item) => item.type === "audio");

  const onGenerateQr = async () => {
    if (!asset) return;

    try {
      const payload = buildAssetQrPayload({
        assetId: asset.id,
        name: asset.name,
        category: asset.category,
        serialNumber: asset.serial_number,
        brand: asset.brand,
        model: asset.model,
      });

      setQrPayload(payload);
      const dataUrl = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
      setIsQrVisible(true);
    } catch {
      setFeedback("QR kodu oluşturulamadı.");
    }
  };

  return (
    <AppShell
      badge="Varlık Detayı"
      title={asset?.name ?? "Varlık"}
      subtitle="Varlık bilgileri, medya galerisi ve paylaşılabilir QR burada."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void onGenerateQr();
            }}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
          >
            QR Oluştur
          </button>
          <Link
            href="/assets"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Varlık Listesine Dön
          </Link>
        </div>
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
            <StatCard label="Toplam Medya" value={String(mediaItems.length)} />
          </section>

          <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Temel Bilgiler</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailItem label="Kategori" value={asset.category} />
                <DetailItem label="Seri Numarası" value={asset.serial_number ?? "-"} />
                <DetailItem label="Marka" value={asset.brand ?? "-"} />
                <DetailItem label="Model" value={asset.model ?? "-"} />
                <DetailItem label="Satın Alma Tarihi" value={formatDate(asset.purchase_date)} />
                <DetailItem label="Garanti Bitiş Tarihi" value={formatDate(asset.warranty_end_date)} />
                <DetailItem label="QR Kod" value={asset.qr_code ?? "-"} />
                <DetailItem label="Oluşturulma" value={formatDate(asset.created_at)} />
              </dl>
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">QR Kartı</h2>
              {isQrVisible && qrDataUrl ? (
                <div className="mt-4 space-y-3">
                  <div className="overflow-hidden rounded-xl bg-white p-3">
                    <Image
                      src={qrDataUrl}
                      alt="Varlık QR kodu"
                      width={320}
                      height={320}
                      unoptimized
                      className="mx-auto h-56 w-56 object-contain"
                    />
                  </div>
                  <p className="rounded-lg border border-white/10 bg-slate-950/60 p-2 text-xs text-slate-300">
                    {qrPayload}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-300">QR kodu ekranda göstermek için “QR Oluştur” butonuna basın.</p>
              )}
            </article>
          </section>

          <section className="premium-card p-5">
            <h2 className="text-lg font-semibold text-white">Medya Galerisi</h2>

            {mediaItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">Bu varlık için henüz medya bulunmuyor.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {imageItems.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Görseller</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {imageItems.map((item) => (
                        <a
                          key={item.id}
                          href={item.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40"
                        >
                          <Image
                            src={item.signed_url}
                            alt="Varlık görseli"
                            width={800}
                            height={600}
                            unoptimized
                            className="h-40 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {videoItems.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Videolar</h3>
                    <div className="mt-3 space-y-3">
                      {videoItems.map((item) => (
                        <video
                          key={item.id}
                          src={item.signed_url}
                          controls
                          className="w-full rounded-xl border border-white/10 bg-black"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {audioItems.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Ses Kayıtları</h3>
                    <div className="mt-3 space-y-3">
                      {audioItems.map((item) => (
                        <audio
                          key={item.id}
                          src={item.signed_url}
                          controls
                          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
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
