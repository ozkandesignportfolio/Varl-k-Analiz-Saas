import type { FormEvent } from "react";

export type ServiceLogFormAssetOption = {
  id: string;
  name: string;
  label: string;
};

type ServiceLogFormRuleOption = {
  id: string;
  title: string;
  next_due_date: string;
};

type ServiceLogFormBaseProps = {
  assets: ServiceLogFormAssetOption[];
  activeRulesForSelectedAsset: ServiceLogFormRuleOption[];
  hasAnyRules: boolean;
  selectedAssetId: string;
  selectedRuleId: string;
  onSelectedAssetIdChange: (assetId: string) => void;
  onSelectedRuleIdChange: (ruleId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  serviceTypes: string[];
  inputClassName: string;
};

type CreateServiceLogFormProps = ServiceLogFormBaseProps & {
  mode: "create";
};

type EditServiceLogFormProps = ServiceLogFormBaseProps & {
  mode: "edit";
  onCancel: () => void;
};

type ServiceLogFormProps = CreateServiceLogFormProps | EditServiceLogFormProps;

export function ServiceLogForm(props: ServiceLogFormProps) {
  if (props.mode === "create") {
    const {
      assets,
      activeRulesForSelectedAsset,
      hasAnyRules,
      selectedAssetId,
      selectedRuleId,
      onSelectedAssetIdChange,
      onSelectedRuleIdChange,
      onSubmit,
      isSubmitting,
      isSubmitDisabled,
      serviceTypes,
      inputClassName,
    } = props;

    return (
      <article className="premium-card p-5" data-testid="service-create-card">
        <h2 className="text-xl font-semibold text-white">Yeni Servis Kaydı</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="service-create-form">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
            <select
              required
              value={selectedAssetId}
              onChange={(event) => onSelectedAssetIdChange(event.target.value)}
              className={inputClassName}
              disabled={assets.length === 0}
              data-testid="service-asset-select"
            >
              <option value="" disabled className="bg-slate-900">
                {assets.length === 0 ? "Önce varlık ekleyin" : "Varlık seçin"}
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id} className="bg-slate-900">
                  {asset.label}
                </option>
              ))}
            </select>
            {assets.length === 0 ? (
              <p className="mt-1.5 text-xs text-amber-200">Önce bir varlık eklemelisiniz.</p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Bakım Kuralı (Opsiyonel)</span>
            <select
              value={selectedRuleId}
              onChange={(event) => onSelectedRuleIdChange(event.target.value)}
              className={inputClassName}
              disabled={!selectedAssetId || activeRulesForSelectedAsset.length === 0}
              data-testid="service-rule-select"
            >
              <option value="" className="bg-slate-900">
                Kural seçmeden devam et
              </option>
              {activeRulesForSelectedAsset.map((rule) => (
                <option key={rule.id} value={rule.id} className="bg-slate-900">
                  {rule.title} (hedef tarih: {rule.next_due_date})
                </option>
              ))}
            </select>
            {!hasAnyRules ? (
              <p className="mt-1.5 text-xs text-slate-300">Kayıtlı bakım kuralı bulunmuyor.</p>
            ) : selectedAssetId && activeRulesForSelectedAsset.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-300">Seçili varlık için aktif bakım kuralı bulunmuyor.</p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Servis Türü</span>
            <select name="serviceType" required defaultValue="" className={inputClassName} data-testid="service-type-select">
              <option value="" disabled className="bg-slate-900">
                Tür seçin
              </option>
              {serviceTypes.map((type) => (
                <option key={type} value={type} className="bg-slate-900">
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Servis Tarihi</span>
            <input name="serviceDate" type="date" required className={inputClassName} data-testid="service-date-input" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Maliyet (TL)</span>
            <input
              name="cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className={inputClassName}
              data-testid="service-cost-input"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Servis Sağlayıcı</span>
            <input
              name="provider"
              className={inputClassName}
              placeholder="Örnek: Yetkili Servis"
              data-testid="service-provider-input"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm text-slate-300">Not</span>
            <textarea
              name="notes"
              rows={3}
              className={inputClassName}
              placeholder="Ek notlar"
              data-testid="service-notes-input"
            />
          </label>

          <p className="md:col-span-2 text-xs text-slate-400">
            Belge yükleme resmi olarak <span className="font-semibold">/documents</span> ekranından yapılır.
          </p>

          <div className="md:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || isSubmitDisabled}
              className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="service-save-button"
            >
              {isSubmitting ? "Kaydediliyor..." : "Servis Kaydını Ekle"}
            </button>
          </div>
        </form>
      </article>
    );
  }

  const {
    assets,
    activeRulesForSelectedAsset,
    hasAnyRules,
    selectedAssetId,
    selectedRuleId,
    onSelectedAssetIdChange,
    onSelectedRuleIdChange,
    onSubmit,
    isSubmitting,
    isSubmitDisabled,
    serviceTypes,
    inputClassName,
    onCancel,
  } = props;

  return (
    <section className="premium-card p-5" data-testid="service-edit-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Servis Kaydını Güncelle</h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
        >
          Vazgeç
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="service-edit-form">
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
          <select
            required
            value={selectedAssetId}
            onChange={(event) => onSelectedAssetIdChange(event.target.value)}
            className={inputClassName}
            disabled={assets.length === 0}
          >
            <option value="" disabled className="bg-slate-900">
              {assets.length === 0 ? "Önce varlık ekleyin" : "Varlık seçin"}
            </option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id} className="bg-slate-900">
                {asset.label}
              </option>
            ))}
          </select>
          {assets.length === 0 ? (
            <p className="mt-1.5 text-xs text-amber-200">Önce bir varlık eklemelisiniz.</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Bakım Kuralı (Opsiyonel)</span>
          <select
            value={selectedRuleId}
            onChange={(event) => onSelectedRuleIdChange(event.target.value)}
            className={inputClassName}
            disabled={!selectedAssetId || activeRulesForSelectedAsset.length === 0}
          >
            <option value="" className="bg-slate-900">
              Kural seçmeden devam et
            </option>
            {activeRulesForSelectedAsset.map((rule) => (
              <option key={rule.id} value={rule.id} className="bg-slate-900">
                {rule.title} (hedef tarih: {rule.next_due_date})
              </option>
            ))}
          </select>
          {!hasAnyRules ? (
            <p className="mt-1.5 text-xs text-slate-300">Kayıtlı bakım kuralı bulunmuyor.</p>
          ) : selectedAssetId && activeRulesForSelectedAsset.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-300">Seçili varlık için aktif bakım kuralı bulunmuyor.</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Servis Türü</span>
          <select name="serviceType" required defaultValue="" className={inputClassName}>
            <option value="" disabled className="bg-slate-900">
              Tür seçin
            </option>
            {serviceTypes.map((type) => (
              <option key={type} value={type} className="bg-slate-900">
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Servis Tarihi</span>
          <input name="serviceDate" type="date" required className={inputClassName} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Maliyet (TL)</span>
          <input
            name="cost"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">Servis Sağlayıcı</span>
          <input name="provider" className={inputClassName} placeholder="Örnek: Yetkili Servis" />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">Not</span>
          <textarea name="notes" rows={3} className={inputClassName} placeholder="Ek notlar" />
        </label>

        <p className="md:col-span-2 text-xs text-slate-400">
          Belge yükleme resmi olarak <span className="font-semibold">/documents</span> ekranından yapılır.
        </p>

        <div className="md:col-span-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting || isSubmitDisabled}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Güncelleniyor..." : "Güncellemeyi Kaydet"}
          </button>
        </div>
      </form>
    </section>
  );
}
