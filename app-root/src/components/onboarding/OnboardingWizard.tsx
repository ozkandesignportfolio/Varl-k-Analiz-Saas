"use client";

import Link from "next/link";
import { useState } from "react";

const STORAGE_KEY = "onboarding_complete";

const categories = ["Ev Elektroniği", "Beyaz Eşya", "Isıtma / Soğutma", "Küçük Ev Aleti"];
const intervals = ["3 ay", "6 ay", "1 yıl"];

type OnboardingWizardProps = {
  shouldOpen: boolean;
};

export default function OnboardingWizard({ shouldOpen }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [assetName, setAssetName] = useState("Samsung TV");
  const [category, setCategory] = useState(categories[0]);
  const [interval, setInterval] = useState(intervals[1]);

  const isVisible = shouldOpen && !isCompleted;
  const progress = [0, 1, 2];

  const completeOnboarding = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsCompleted(true);
    setStep(0);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#040712]/85 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0A1226] shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hoş Geldiniz</p>
            <p className="text-lg font-semibold text-white">Hızlı Kurulum Sihirbazı</p>
          </div>
          <button
            type="button"
            onClick={completeOnboarding}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Atla
          </button>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="mb-5 flex items-center gap-2">
            {progress.map((dot) => (
              <span
                key={dot}
                className={`h-2.5 w-2.5 rounded-full ${dot <= step ? "bg-indigo-400" : "bg-white/20"}`}
              />
            ))}
          </div>

          {step === 0 ? (
            <section>
              <h3 className="text-xl font-semibold text-white">İlk varlığınızı ekleyin</h3>
              <p className="mt-2 text-sm text-slate-300">Hızlı başlamak için örnek varlık adını kullanabilir veya düzenleyebilirsiniz.</p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssetName("Samsung TV")}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200"
                >
                  Samsung TV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssetName("Buzdolabı");
                    setCategory("Beyaz Eşya");
                  }}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200"
                >
                  Buzdolabı
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-400">Varlık adı</span>
                  <input
                    value={assetName}
                    onChange={(event) => setAssetName(event.target.value)}
                    className="mt-1 w-full bg-transparent text-sm text-white outline-none"
                  />
                </label>

                <label className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-400">Kategori</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-1 w-full bg-transparent text-sm text-white outline-none"
                  >
                    {categories.map((item) => (
                      <option key={item} value={item} className="bg-[#0A1226] text-white">
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section>
              <h3 className="text-xl font-semibold text-white">Bakım periyodu belirleyin</h3>
              <p className="mt-2 text-sm text-slate-300">Bakım hatırlatıcıları bu periyoda göre otomatik üretilecek.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {intervals.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInterval(preset)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      interval === preset
                        ? "border-indigo-400/60 bg-indigo-500/20 text-white"
                        : "border-white/15 bg-white/[0.03] text-slate-200"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <h3 className="text-xl font-semibold text-white">Hazırsınız!</h3>
              <p className="mt-2 text-sm text-slate-300">İlk kurulum tamamlandı. Oluşturulan kayıtlar aşağıda:</p>

              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                <p>
                  Varlık: <strong className="text-white">{assetName}</strong>
                </p>
                <p>
                  Kategori: <strong className="text-white">{category}</strong>
                </p>
                <p>
                  Bakım periyodu: <strong className="text-white">{interval}</strong>
                </p>
                <p className="text-slate-400">Sonraki adım: Varlığa garanti belgesi ve servis fişi ekleyin.</p>
              </div>
            </section>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={completeOnboarding}
              className="text-xs font-semibold text-slate-300 underline-offset-4 transition hover:text-white hover:underline"
            >
              Bu adımı geç
            </button>

            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
                >
                  Geri
                </button>
              ) : null}

              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white"
                >
                  Devam
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  onClick={completeOnboarding}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white"
                >
                  Panele Git
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
