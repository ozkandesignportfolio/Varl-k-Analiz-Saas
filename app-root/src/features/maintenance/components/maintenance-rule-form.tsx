import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { IntervalUnit } from "@/lib/maintenance/next-due";

type AssetOption = {
  id: string;
  name: string;
};

export type RuleFormState = {
  assetId: string;
  title: string;
  intervalValue: string;
  intervalUnit: IntervalUnit;
  lastServiceDate: string;
};

type IntervalUnitOption = {
  value: IntervalUnit;
  label: string;
};

type MaintenanceRuleFormBaseProps = {
  assets: AssetOption[];
  form: RuleFormState;
  setForm: Dispatch<SetStateAction<RuleFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  duePreview: string;
  inputClassName: string;
  intervalUnitOptions: IntervalUnitOption[];
};

type CreateMaintenanceRuleFormProps = MaintenanceRuleFormBaseProps & {
  mode: "create";
};

type EditMaintenanceRuleFormProps = MaintenanceRuleFormBaseProps & {
  mode: "edit";
  onCancel: () => void;
};

type MaintenanceRuleFormProps = CreateMaintenanceRuleFormProps | EditMaintenanceRuleFormProps;

export function MaintenanceRuleForm(props: MaintenanceRuleFormProps) {
  if (props.mode === "create") {
    const {
      assets,
      form,
      setForm,
      onSubmit,
      isSubmitting,
      duePreview,
      inputClassName,
      intervalUnitOptions,
    } = props;

    return (
      <article className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Yeni Kural Oluştur</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
            <select
              required
              className={inputClassName}
              value={form.assetId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, assetId: event.target.value }))
              }
            >
              <option value="" disabled className="bg-slate-900">
                Varlık seçin
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id} className="bg-slate-900">
                  {asset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Kural Basligi</span>
            <input
              required
              className={inputClassName}
              placeholder="Örnek: Filtre Değişimi"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Interval Degeri</span>
            <input
              required
              type="number"
              min={1}
              step={1}
              className={inputClassName}
              value={form.intervalValue}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, intervalValue: event.target.value }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Interval Birimi</span>
            <select
              className={inputClassName}
              value={form.intervalUnit}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  intervalUnit: event.target.value as IntervalUnit,
                }))
              }
            >
              {intervalUnitOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-slate-300">Baz Tarih</span>
            <input
              required
              type="date"
              className={inputClassName}
              value={form.lastServiceDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, lastServiceDate: event.target.value }))
              }
            />
          </label>

          <div className="md:col-span-2 rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
            Hesaplanan sonraki bakım tarihi: <strong>{duePreview}</strong>
          </div>

          <div className="md:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || assets.length === 0}
              className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kaydediliyor..." : "Kuralı Oluştur"}
            </button>
          </div>
        </form>
      </article>
    );
  }

  const {
    assets,
    form,
    setForm,
    onSubmit,
    isSubmitting,
    duePreview,
    inputClassName,
    intervalUnitOptions,
    onCancel,
  } = props;

  return (
    <section className="premium-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Kuralı Düzenle</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
        >
          Vazgec
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
          <select
            required
            className={inputClassName}
            value={form.assetId}
            onChange={(event) => setForm((prev) => ({ ...prev, assetId: event.target.value }))}
          >
            <option value="" disabled className="bg-slate-900">
              Varlık seçin
            </option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id} className="bg-slate-900">
                {asset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Kural Basligi</span>
          <input
            required
            className={inputClassName}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Interval Degeri</span>
          <input
            required
            type="number"
            min={1}
            step={1}
            className={inputClassName}
            value={form.intervalValue}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, intervalValue: event.target.value }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Interval Birimi</span>
          <select
            className={inputClassName}
            value={form.intervalUnit}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                intervalUnit: event.target.value as IntervalUnit,
              }))
            }
          >
            {intervalUnitOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Baz Tarih</span>
          <input
            required
            type="date"
            className={inputClassName}
            value={form.lastServiceDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lastServiceDate: event.target.value }))
            }
          />
        </label>

        <div className="md:col-span-2 rounded-xl border border-indigo-300/25 bg-indigo-300/10 px-4 py-3 text-sm text-indigo-100">
          Hesaplanan sonraki bakım tarihi: <strong>{duePreview}</strong>
        </div>

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

