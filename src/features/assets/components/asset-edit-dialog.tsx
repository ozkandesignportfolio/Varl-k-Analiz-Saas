"use client";

import type { FormEventHandler } from "react";
import { AssetForm } from "@/features/assets/components/asset-form";
import type { AssetDashboardRow } from "@/features/assets/components/assets-view-types";
import { useAssetMediaSelection } from "@/features/assets/hooks/useAssetMediaSelection";
import type { AssetMediaSelection } from "@/features/assets/lib/assets-actions-utils";

type ExistingMediaItem = {
  id: string;
  type: "image" | "video" | "audio";
  label: string;
};

type AssetEditDialogProps = {
  asset: AssetDashboardRow;
  onCancel: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isSubmitting: boolean;
  categoryOptions: string[];
  inputClassName: string;
  isPremiumMediaEnabled: boolean;
  mediaErrorMessage: string;
  mediaSummary: string;
  onMediaSelection: (selection: AssetMediaSelection) => void;
  existingMediaItems: ExistingMediaItem[];
  isLoadingExistingMedia: boolean;
  removingExistingMediaId: string | null;
  onRemoveExistingMedia: (mediaId: string) => void;
};

const fileInputClassName =
  "block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-sky-400/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-100 hover:file:bg-sky-400/25";

export function AssetEditDialog({
  asset,
  onCancel,
  onSubmit,
  isSubmitting,
  categoryOptions,
  inputClassName,
  isPremiumMediaEnabled,
  mediaErrorMessage,
  mediaSummary,
  onMediaSelection,
  existingMediaItems,
  isLoadingExistingMedia,
  removingExistingMediaId,
  onRemoveExistingMedia,
}: AssetEditDialogProps) {
  const { onImagesChange, onVideoChange, onAudioChange } = useAssetMediaSelection(asset.id, onMediaSelection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Duzenle</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{asset.name}</h2>
            <p className="mt-1 text-sm text-slate-300">Kaydi guncelleyin ve degisiklikleri kaydedin.</p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Kapat
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <AssetForm
            mode="edit"
            asset={asset}
            formId="asset-edit-form"
            formTestId="asset-edit-form"
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            categoryOptions={categoryOptions}
            inputClassName={inputClassName}
            footer={<></>}
          />

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Mevcut Medya</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {isPremiumMediaEnabled
                    ? "Gerekirse mevcut medyayi kaldirabilir ve yeni dosyalar ekleyebilirsiniz."
                    : "Medya guncellemeleri Premium planda kullanilabilir."}
                </p>
              </div>
            </div>

            {isLoadingExistingMedia ? (
              <p className="mt-3 text-sm text-slate-300">Medya kayitlari yukleniyor...</p>
            ) : existingMediaItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">Bu varlik icin mevcut medya yok.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {existingMediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveExistingMedia(item.id)}
                      disabled={removingExistingMediaId === item.id}
                      className="rounded-full border border-rose-300/35 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingExistingMediaId === item.id ? "Siliniyor..." : "Kaldir"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isPremiumMediaEnabled ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Gorseller</span>
                  <input type="file" accept="image/*" multiple onChange={onImagesChange} className={fileInputClassName} />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Video</span>
                  <input type="file" accept="video/*" onChange={onVideoChange} className={fileInputClassName} />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Ses</span>
                  <input type="file" accept="audio/*" onChange={onAudioChange} className={fileInputClassName} />
                </label>
              </div>
            ) : null}

            {mediaSummary ? <p className="mt-4 text-sm text-sky-200">{mediaSummary}</p> : null}
            {mediaErrorMessage ? <p className="mt-2 text-sm text-rose-200">{mediaErrorMessage}</p> : null}
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Iptal
            </button>
            <button
              type="submit"
              form="asset-edit-form"
              disabled={isSubmitting}
              className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
