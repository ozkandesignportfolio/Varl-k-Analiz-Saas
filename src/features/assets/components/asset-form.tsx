import type { FormEvent } from "react";

type AssetFormAsset = {
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
};

type AssetFormBaseProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  categoryOptions: string[];
  inputClassName: string;
};

type CreateAssetFormProps = AssetFormBaseProps & {
  mode: "create";
};

type EditAssetFormProps = AssetFormBaseProps & {
  mode: "edit";
  asset: AssetFormAsset;
  onCancel: () => void;
};

type AssetFormProps = CreateAssetFormProps | EditAssetFormProps;

export function AssetForm(props: AssetFormProps) {
  if (props.mode === "create") {
    const { onSubmit, isSubmitting, categoryOptions, inputClassName } = props;

    return (
      <article className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Yeni Varlık Ekle</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
            <input name="name" required className={inputClassName} placeholder="Örnek: Kombi" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Kategori</span>
            <select name="category" required className={inputClassName} defaultValue="">
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
            <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
            <input name="brand" className={inputClassName} placeholder="Örnek: Bosch" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Model</span>
            <input name="model" className={inputClassName} placeholder="Örnek: X200" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
            <input name="purchaseDate" type="date" className={inputClassName} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
            <input name="warrantyEndDate" type="date" className={inputClassName} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-slate-300">Fotoğraf (JPG/PNG)</span>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
            />
          </label>

          <div className="md:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kaydediliyor..." : "Varlığı Kaydet"}
            </button>
          </div>
        </form>
      </article>
    );
  }

  const { onSubmit, isSubmitting, categoryOptions, inputClassName, asset, onCancel } = props;

  return (
    <section className="premium-card p-5">
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

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
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

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Yeni Fotoğraf (Opsiyonel)</span>
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png"
            className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
          />
          {asset.photo_path ? (
            <p className="mt-2 text-xs text-slate-400">Mevcut fotoğraf yolu: {asset.photo_path}</p>
          ) : null}
        </label>

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

