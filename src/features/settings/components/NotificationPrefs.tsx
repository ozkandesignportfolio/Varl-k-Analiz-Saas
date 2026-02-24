"use client";

export type NotificationFrequency = "Anında" | "Günlük özet" | "Haftalık özet";

export type NotificationPrefsState = {
  maintenance: boolean;
  warranty: boolean;
  document: boolean;
  payment: boolean;
  system: boolean;
  inApp: boolean;
  email: boolean;
  frequency: NotificationFrequency;
};

type NotificationPrefsProps = {
  value: NotificationPrefsState;
  onChange: (nextValue: NotificationPrefsState) => void;
  isSaving?: boolean;
};

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

function ToggleRow({ label, description, checked, disabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
          checked ? "border-emerald-300/40 bg-emerald-400/30" : "border-white/15 bg-white/10"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

const FREQUENCY_OPTIONS: NotificationFrequency[] = ["Anında", "Günlük özet", "Haftalık özet"];

export function NotificationPrefs({ value, onChange, isSaving = false }: NotificationPrefsProps) {
  return (
    <section className="space-y-4">
      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-lg font-semibold text-white">Bildirim Tercihleri</h3>
        <p className="mt-1 text-sm text-slate-300">
          Hangi bildirimleri almak istediğinizi ve gönderim sıklığını buradan belirleyin.
        </p>
        {isSaving ? <p className="mt-1 text-xs text-sky-200">Tercihler kaydediliyor...</p> : null}

        <div className="mt-4 grid gap-2">
          <ToggleRow
            label="Bakım hatırlatmaları"
            description="Planlı bakım tarihleri yaklaşınca bildirim gönder."
            checked={value.maintenance}
            onToggle={() => onChange({ ...value, maintenance: !value.maintenance })}
          />
          <ToggleRow
            label="Garanti bitiş uyarıları"
            description="Garanti süresi kritik eşiğe geldiğinde bilgilendir."
            checked={value.warranty}
            onToggle={() => onChange({ ...value, warranty: !value.warranty })}
          />
          <ToggleRow
            label="Belge eksik uyarıları"
            description="Eksik servis ve evrak kayıtlarını hatırlat."
            checked={value.document}
            onToggle={() => onChange({ ...value, document: !value.document })}
          />
          <ToggleRow
            label="Ödeme/fatura hatırlatmaları"
            description="Tahsilat ve son ödeme tarihleri için uyarı üret."
            checked={value.payment}
            onToggle={() => onChange({ ...value, payment: !value.payment })}
          />
          <ToggleRow
            label="Sistem bildirimleri"
            description="Sistem güncellemeleri ve önemli panel olaylarını paylaş."
            checked={value.system}
            onToggle={() => onChange({ ...value, system: !value.system })}
          />
        </div>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Kanallar</h4>
        <div className="mt-3 grid gap-2">
          <ToggleRow
            label="Uygulama içi"
            description="Panel içi bildirim merkezi her zaman aktif."
            checked={value.inApp}
            onToggle={() => onChange({ ...value, inApp: !value.inApp })}
          />
          <ToggleRow
            label="E-posta"
            description="Özet ve kritik uyarıları e-posta üzerinden gönder."
            checked={value.email}
            onToggle={() => onChange({ ...value, email: !value.email })}
          />
        </div>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Frekans</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = value.frequency === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ ...value, frequency: option })}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  selected
                    ? "border-sky-300/45 bg-sky-300/15 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </article>
    </section>
  );
}
