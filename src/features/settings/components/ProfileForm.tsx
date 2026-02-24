"use client";

import { Button } from "@/components/ui/button";

export type ProfileFormValues = {
  fullName: string;
  email: string;
};

type ProfileFormProps = {
  values: ProfileFormValues;
  onChange: (nextValues: ProfileFormValues) => void;
  isSaveDisabled?: boolean;
};

const INPUT_CLASS_NAME =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300";

export function ProfileForm({ values, onChange, isSaveDisabled = true }: ProfileFormProps) {
  return (
    <section className="premium-card border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-lg font-semibold text-white">Profil</h3>
      <p className="mt-1 text-sm text-slate-300">
        Hesap bilgileriniz burada görüntülenir. E-posta alanı güvenlik nedeniyle salt okunur tutulur.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-1">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Ad Soyad</span>
          <input
            type="text"
            value={values.fullName}
            onChange={(event) =>
              onChange({
                ...values,
                fullName: event.target.value,
              })
            }
            className={INPUT_CLASS_NAME}
            placeholder="Adınızı ve soyadınızı girin"
          />
        </label>

        <label className="space-y-1.5 sm:col-span-1">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">E-posta</span>
          <input type="email" value={values.email} readOnly className={`${INPUT_CLASS_NAME} opacity-80`} />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button
          type="button"
          disabled={isSaveDisabled}
          className="bg-white/10 text-white hover:bg-white/15 disabled:bg-white/8"
        >
          Kaydet
        </Button>
        {isSaveDisabled ? <p className="text-xs text-slate-400">Profil kaydetme adımı MVP’de pasif.</p> : null}
      </div>
    </section>
  );
}
