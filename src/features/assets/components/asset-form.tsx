import Link from "next/link";
import type { FormEvent } from "react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetMediaType } from "@/lib/assets/media-limits";

type AssetFormAsset = {
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
};

export type CreateAssetFormDefaults = {
  name?: string | null;
  category?: string | null;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  warrantyEndDate?: string | null;
};

type CreateAssetMediaSummary = {
  imageCount: number;
  videoFileName: string | null;
  audioFileName: string | null;
  totalSizeLabel: string;
};

export type AssetFormExistingMediaItem = {
  id: string;
  type: AssetMediaType;
  storagePath: string;
  signedUrl: string;
  createdAt: string;
  isLegacy?: boolean;
};

type AssetFormMediaProps = {
  isPremiumMediaEnabled: boolean;
  mediaErrorMessage: string;
  mediaSummary: CreateAssetMediaSummary;
  onMediaSelection: (
    type: AssetMediaType,
    files: FileList | null,
    input: HTMLInputElement,
  ) => void;
};

type AssetFormBaseProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  categoryOptions: string[];
  inputClassName: string;
};

type CreateAssetFormProps = AssetFormBaseProps &
  AssetFormMediaProps & {
  mode: "create";
  defaults?: CreateAssetFormDefaults;
};

type EditAssetFormProps = AssetFormBaseProps &
  AssetFormMediaProps & {
  mode: "edit";
  asset: AssetFormAsset;
  onCancel: () => void;
  existingMediaItems: AssetFormExistingMediaItem[];
  isLoadingExistingMedia: boolean;
  removingExistingMediaId: string | null;
  onRemoveExistingMedia: (item: AssetFormExistingMediaItem) => void;
};

type AssetFormProps = CreateAssetFormProps | EditAssetFormProps;

export function AssetForm(props: AssetFormProps) {
  if (props.mode === "create") {
    const {
      onSubmit,
      isSubmitting,
      categoryOptions,
      inputClassName,
      defaults,
      isPremiumMediaEnabled,
      mediaErrorMessage,
      mediaSummary,
      onMediaSelection,
    } = props;

    return (
      <article className="premium-card p-5" data-testid="asset-create-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-white">Yeni Varlık Ekle</h2>
          <Badge variant="outline" className="border-sky-300/40 bg-sky-300/10 text-sky-100">
            Premium Medya Destekli
          </Badge>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4" data-testid="asset-create-form">
          <Tabs defaultValue="basic">
            <TabsList
              variant="line"
              className="w-full justify-start border-b border-white/15 pb-1 text-slate-300"
            >
              <TabsTrigger value="basic" className="max-w-max px-4 text-sm text-slate-100">
                Temel Bilgiler
              </TabsTrigger>
              <TabsTrigger value="media" className="max-w-max px-4 text-sm text-slate-100">
                Ek Medya (Premium)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" forceMount className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
                  <input
                    name="name"
                    required
                    defaultValue={defaults?.name ?? ""}
                    className={inputClassName}
                    placeholder="Örnek: Kombi"
                    data-testid="asset-name-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Kategori</span>
                  <select
                    name="category"
                    required
                    className={inputClassName}
                    defaultValue={defaults?.category ?? ""}
                    data-testid="asset-category-select"
                  >
                    <option value="" disabled className="bg-slate-900">
                      Kategori seçin
                    </option>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Seri Numarası</span>
                  <input
                    name="serialNumber"
                    defaultValue={defaults?.serialNumber ?? ""}
                    className={inputClassName}
                    placeholder="Örnek: SN-2026-00123"
                    data-testid="asset-serial-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
                  <input
                    name="brand"
                    defaultValue={defaults?.brand ?? ""}
                    className={inputClassName}
                    placeholder="Örnek: Bosch"
                    data-testid="asset-brand-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Model</span>
                  <input
                    name="model"
                    defaultValue={defaults?.model ?? ""}
                    className={inputClassName}
                    placeholder="Örnek: X200"
                    data-testid="asset-model-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
                  <input
                    name="purchaseDate"
                    type="date"
                    defaultValue={defaults?.purchaseDate ?? ""}
                    className={inputClassName}
                    data-testid="asset-purchase-date-input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
                  <input
                    name="warrantyEndDate"
                    type="date"
                    defaultValue={defaults?.warrantyEndDate ?? ""}
                    className={inputClassName}
                    data-testid="asset-warranty-date-input"
                  />
                </label>
              </div>
            </TabsContent>

            <TabsContent value="media" forceMount className="mt-4">
              <section
                className={`rounded-xl border p-4 ${
                  isPremiumMediaEnabled
                    ? "border-white/15 bg-white/[0.04]"
                    : "border-amber-300/30 bg-amber-300/5"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Varlığa fotoğraf, video ve ses ekleyin.</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Fotoğraf: max 5 adet (3 MB) • Video: max 1 adet (20 MB) • Ses: max 1 adet (10 MB)
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Toplam medya limiti: 30 MB</p>
                  </div>
                  {!isPremiumMediaEnabled ? (
                    <Badge className="border-amber-300/40 bg-amber-300/15 text-amber-100">Premium&apos;da aktif</Badge>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-sm text-slate-300">Fotoğraf Ekle (çoklu)</span>
                    <input
                      type="file"
                      name="images"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      disabled={!isPremiumMediaEnabled}
                      onChange={(event) => onMediaSelection("image", event.target.files, event.target)}
                      className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-slate-300">Video Ekle (max 1)</span>
                    <input
                      type="file"
                      name="video"
                      accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                      disabled={!isPremiumMediaEnabled}
                      onChange={(event) => onMediaSelection("video", event.target.files, event.target)}
                      className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-slate-300">Ses Kaydı / Ses Dosyası (max 1)</span>
                    <input
                      type="file"
                      name="audio"
                      accept="audio/*"
                      capture
                      disabled={!isPremiumMediaEnabled}
                      onChange={(event) => onMediaSelection("audio", event.target.files, event.target)}
                      className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                  <p>Seçilen fotoğraf: {mediaSummary.imageCount}</p>
                  <p>Seçilen video: {mediaSummary.videoFileName ?? "-"}</p>
                  <p>Seçilen ses: {mediaSummary.audioFileName ?? "-"}</p>
                  <p>Toplam seçili boyut: {mediaSummary.totalSizeLabel}</p>
                </div>

                {mediaErrorMessage ? (
                  <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                    {mediaErrorMessage}
                  </p>
                ) : null}

                {!isPremiumMediaEnabled ? (
                  <div className="mt-4 rounded-lg border border-amber-300/35 bg-slate-900/60 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                      <Lock className="h-4 w-4" />
                      Premium Özellik
                    </p>
                    <p className="mt-1 text-xs text-amber-100/90">
                      Varlığa fotoğraf, video ve ses ekleme özelliği yalnızca Premium planda aktif.
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-3 inline-flex rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-xs font-semibold text-slate-950"
                    >
                      Premium’a Geç
                    </Link>
                  </div>
                ) : null}
              </section>
            </TabsContent>
          </Tabs>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="asset-submit"
            >
              {isSubmitting ? "Kaydediliyor..." : "Varlığı Kaydet"}
            </button>
          </div>
        </form>
      </article>
    );
  }

  const {
    onSubmit,
    isSubmitting,
    categoryOptions,
    inputClassName,
    asset,
    onCancel,
    isPremiumMediaEnabled,
    mediaErrorMessage,
    mediaSummary,
    onMediaSelection,
    existingMediaItems,
    isLoadingExistingMedia,
    removingExistingMediaId,
    onRemoveExistingMedia,
  } = props;

  return (
    <section className="premium-card p-5" data-testid="asset-edit-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Varlık Güncelle</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
        >
          Vazgeç
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="asset-edit-form">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
          <input name="name" defaultValue={asset.name} required className={inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Kategori</span>
          <select
            name="category"
            required
            className={inputClassName}
            defaultValue={asset.category}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option} className="bg-slate-900">
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Seri Numarası</span>
          <input
            name="serialNumber"
            defaultValue={asset.serial_number ?? ""}
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
          <input name="brand" defaultValue={asset.brand ?? ""} className={inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Model</span>
          <input name="model" defaultValue={asset.model ?? ""} className={inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
          <input
            name="purchaseDate"
            type="date"
            defaultValue={asset.purchase_date ?? ""}
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
          <input
            name="warrantyEndDate"
            type="date"
            defaultValue={asset.warranty_end_date ?? ""}
            className={inputClassName}
          />
        </label>

        <section
          className={`md:col-span-2 mt-1 rounded-xl border p-4 ${
            isPremiumMediaEnabled ? "border-white/15 bg-white/[0.04]" : "border-amber-300/30 bg-amber-300/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Ek Medya (Premium)</p>
              <p className="mt-1 text-xs text-slate-300">
                Düzenleme sırasında fotoğraf, video ve ses ekleyebilirsiniz.
              </p>
            </div>
            {!isPremiumMediaEnabled ? (
              <Badge className="border-amber-300/40 bg-amber-300/15 text-amber-100">Premium&apos;da aktif</Badge>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold text-slate-200">Mevcut Medyalar</p>
            {isLoadingExistingMedia ? (
              <p className="mt-2 text-xs text-slate-300">Yukleniyor...</p>
            ) : existingMediaItems.length === 0 ? (
              <p className="mt-2 text-xs text-slate-300">Kayitli medya bulunmuyor.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {existingMediaItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="text-xs text-slate-200">
                      <p className="font-medium">
                        {item.type === "image" ? "Gorsel" : item.type === "video" ? "Video" : "Ses"}
                        {item.isLegacy ? " (Legacy)" : ""}
                      </p>
                      <p className="text-slate-400">{new Date(item.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Onizle
                      </a>
                      <button
                        type="button"
                        disabled={removingExistingMediaId === item.id}
                        onClick={() => onRemoveExistingMedia(item)}
                        className="rounded-full border border-rose-300/35 bg-rose-300/10 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingExistingMediaId === item.id ? "Siliniyor..." : "Kaldir"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Fotoğraf Ekle (çoklu)</span>
              <input
                type="file"
                name="edit-images"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic"
                disabled={!isPremiumMediaEnabled}
                onChange={(event) => onMediaSelection("image", event.target.files, event.target)}
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Video Ekle (max 1)</span>
              <input
                type="file"
                name="edit-video"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                disabled={!isPremiumMediaEnabled}
                onChange={(event) => onMediaSelection("video", event.target.files, event.target)}
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Ses Kaydı / Ses Dosyası (max 1)</span>
              <input
                type="file"
                name="edit-audio"
                accept="audio/*"
                capture
                disabled={!isPremiumMediaEnabled}
                onChange={(event) => onMediaSelection("audio", event.target.files, event.target)}
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
            <p>Seçilen fotoğraf: {mediaSummary.imageCount}</p>
            <p>Seçilen video: {mediaSummary.videoFileName ?? "-"}</p>
            <p>Seçilen ses: {mediaSummary.audioFileName ?? "-"}</p>
            <p>Toplam seçili boyut: {mediaSummary.totalSizeLabel}</p>
          </div>

          {mediaErrorMessage ? (
            <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
              {mediaErrorMessage}
            </p>
          ) : null}

          {!isPremiumMediaEnabled ? (
            <div className="mt-4 rounded-lg border border-amber-300/35 bg-slate-900/60 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                <Lock className="h-4 w-4" />
                Premium Özellik
              </p>
              <p className="mt-1 text-xs text-amber-100/90">
                Düzenleme sırasında medya ekleme özelliği yalnızca Premium planda aktif.
              </p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-xs font-semibold text-slate-950"
              >
                Premium&apos;a Geç
              </Link>
            </div>
          ) : null}
        </section>

        <div className="md:col-span-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Güncelleniyor..." : "Güncellemeyi Kaydet"}
          </button>
        </div>
      </form>
    </section>
  );
}
