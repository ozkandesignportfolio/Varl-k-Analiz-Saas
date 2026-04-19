import { useEffect, useMemo, useState, type FormEventHandler, type ReactNode } from "react";
import { AssetFormSelect } from "@/features/assets/components/asset-form-select";
import type { AssetDashboardRow } from "@/features/assets/components/assets-view-types";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_CATEGORY_VALUE,
  FALLBACK_CATEGORY_OPTIONS,
} from "@/features/assets/lib/assets-actions-utils";

export type CreateAssetFormDefaults = {
  name: string;
  category: string;
  serialNumber: string;
  brand: string;
  model: string;
  purchasePrice: string;
  purchaseDate: string;
  warrantyEndDate: string;
};

type AssetFormBaseProps = {
  categoryOptions: string[];
  inputClassName: string;
  footer?: ReactNode;
};

type AssetFormCreateProps = AssetFormBaseProps & {
  mode: "create";
  defaults: CreateAssetFormDefaults;
  formId?: string;
  formTestId?: string;
  submitLabel?: string;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

type AssetFormEditProps = AssetFormBaseProps & {
  mode: "edit";
  asset: AssetDashboardRow;
  formId?: string;
  formTestId?: string;
  submitLabel?: string;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export type AssetFormProps = AssetFormCreateProps | AssetFormEditProps;

export function AssetForm(props: AssetFormProps) {
  const values =
    props.mode === "create"
      ? props.defaults
      : {
          name: props.asset.name,
          category: props.asset.category,
          serialNumber: props.asset.serial_number ?? "",
          brand: props.asset.brand ?? "",
          model: props.asset.model ?? "",
          purchasePrice: props.asset.purchase_price?.toString() ?? "",
          purchaseDate: props.asset.purchase_date ?? "",
          warrantyEndDate: props.asset.warranty_end_date ?? "",
        };
  const currentCategory = values.category.trim();
  const categoryOptions = useMemo(
    () => [
      ...new Set(
        [...FALLBACK_CATEGORY_OPTIONS, ...props.categoryOptions]
          .map((option) => option.trim())
          .filter(Boolean)
          .concat(currentCategory ? [currentCategory] : []),
      ),
    ],
    [currentCategory, props.categoryOptions],
  );
  const hasPresetCategory = currentCategory ? categoryOptions.includes(currentCategory) : false;
  const derivedSelectedCategory =
    hasPresetCategory ? currentCategory || categoryOptions[0] || FALLBACK_CATEGORY_OPTIONS[0] : CUSTOM_CATEGORY_VALUE;
  const derivedCustomCategory = hasPresetCategory ? "" : currentCategory;
  const [selectedCategory, setSelectedCategory] = useState(derivedSelectedCategory);
  const [customCategory, setCustomCategory] = useState(derivedCustomCategory);
  const categoryLabelId = `${props.formId ?? props.mode}-category-label`;
  const categorySelectOptions = useMemo(
    () => [
      ...categoryOptions.map((option) => ({ label: option, value: option })),
      { label: CUSTOM_CATEGORY_LABEL, value: CUSTOM_CATEGORY_VALUE },
    ],
    [categoryOptions],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedCategory(derivedSelectedCategory);
      setCustomCategory(derivedCustomCategory);
    });
  }, [derivedCustomCategory, derivedSelectedCategory]);

  const footer = props.footer ?? (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={props.isSubmitting}
        data-testid={props.mode === "create" ? "asset-submit" : undefined}
        className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {props.isSubmitting ? "Kaydediliyor..." : (props.submitLabel ?? "Kaydet")}
      </button>
    </div>
  );

  return (
    <form
      id={props.formId}
      data-testid={props.formTestId}
      onSubmit={props.onSubmit}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
          <input
            name="name"
            required
            defaultValue={values.name}
            className={props.inputClassName}
            data-testid={props.mode === "create" ? "asset-name-input" : undefined}
          />
        </label>

        <label className="block">
          <span id={categoryLabelId} className="mb-1.5 block text-sm text-slate-300">
            Kategori
          </span>
          <input type="hidden" name="category" value={selectedCategory} required readOnly />
          <AssetFormSelect
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            options={categorySelectOptions}
            ariaLabelledBy={categoryLabelId}
            dataTestId={props.mode === "create" ? "asset-category-select" : undefined}
          />
        </label>

        {selectedCategory === CUSTOM_CATEGORY_VALUE ? (
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Özel kategori</span>
            <input
              name="customCategory"
              required
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Örn. Kamera sistemi"
              className={props.inputClassName}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
          <input
            name="brand"
            defaultValue={values.brand}
            className={props.inputClassName}
            data-testid={props.mode === "create" ? "asset-brand-input" : undefined}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Model</span>
          <input
            name="model"
            defaultValue={values.model}
            className={props.inputClassName}
            data-testid={props.mode === "create" ? "asset-model-input" : undefined}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Seri Numarası</span>
          <input name="serialNumber" defaultValue={values.serialNumber} className={props.inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Bedeli</span>
          <input
            name="purchasePrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={values.purchasePrice}
            className={props.inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
          <input name="purchaseDate" type="date" defaultValue={values.purchaseDate} className={props.inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
          <input
            name="warrantyEndDate"
            type="date"
            defaultValue={values.warrantyEndDate}
            className={props.inputClassName}
          />
        </label>
      </div>

      {footer}
    </form>
  );
}
