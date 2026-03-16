"use client";

import type { FormEventHandler } from "react";
import { AssetForm, type CreateAssetFormDefaults } from "@/features/assets/components/asset-form";
import { useAssetMediaSelection } from "@/features/assets/hooks/useAssetMediaSelection";
import type { AssetMediaSelection } from "@/features/assets/lib/assets-actions-utils";

type AssetCreateDialogProps = {
  createFormKey: number;
  defaults: CreateAssetFormDefaults;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isSubmitting: boolean;
  categoryOptions: string[];
  inputClassName: string;
  isPremiumMediaEnabled: boolean;
  mediaErrorMessage: string;
  mediaSummary: string;
  onMediaSelection: (selection: AssetMediaSelection) => void;
  onUpgradeToPremium: () => void;
};

const fileInputClassName =
  "block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-sky-400/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-100 hover:file:bg-sky-400/25";

export function AssetCreateDialog({
  createFormKey,
  defaults,
  onSubmit,
  isSubmitting,
  categoryOptions,
  inputClassName,
  isPremiumMediaEnabled,
  mediaErrorMessage,
  mediaSummary,
  onMediaSelection,
  onUpgradeToPremium,
}: AssetCreateDialogProps) {
  const { onImagesChange, onVideoChange, onAudioChange } = useAssetMediaSelection(createFormKey, onMediaSelection);

  return (
    <section className="premium-card p-5" key={createFormKey}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Olustur</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Yeni Varlik</h2>
          <p className="mt-1 text-sm text-slate-300">Kayitlari hizlica olusturun ve envanteri guncel tutun.</p>
        </div>

        {!isPremiumMediaEnabled ? (
          <button
            type="button"
            onClick={onUpgradeToPremium}
            className="rounded-full border border-sky-300/35 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/20"
          >
            Premium
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        <AssetForm
          mode="create"
          defaults={defaults}
          formId="asset-create-form"
          formTestId="asset-create-form"
          submitLabel="Varlik Kaydet"
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          categoryOptions={categoryOptions}
          inputClassName={inputClassName}
        />
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Ek Medya</h3>
            <p className="mt-1 text-xs text-slate-400">
              {isPremiumMediaEnabled
                ? "Istege bagli olarak gorsel, video ve ses dosyasi ekleyebilirsiniz."
                : "Ek medya yukleme Premium plana ozeldir."}
            </p>
          </div>
          {!isPremiumMediaEnabled ? (
            <button
              type="button"
              onClick={onUpgradeToPremium}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Yukselt
            </button>
          ) : null}
        </div>

        {isPremiumMediaEnabled ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Gorseller</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onImagesChange}
                className={fileInputClassName}
              />
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
    </section>
  );
}
