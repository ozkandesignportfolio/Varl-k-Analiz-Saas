"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type PlanCode = "free" | "premium";
type ApiPlanCode = "starter" | "pro";

type Plan = {
  code: PlanCode;
  apiCode: ApiPlanCode;
  name: string;
  headline: string;
  description: string;
  features: string[];
  highlight?: boolean;
};

type FaqItem = {
  question: string;
  answer: string;
};

const plans: Plan[] = [
  {
    code: "free",
    apiCode: "starter",
    name: "Ücretsiz Deneme",
    headline: "0 TL",
    description: "3 varlığa kadar temel takip",
    features: ["En fazla 3 varlık", "Bakım ve servis kayıtları", "Temel zaman akışı görünümü"],
  },
  {
    code: "premium",
    apiCode: "pro",
    name: "Premium",
    headline: "149 TL / ay",
    description: "Sınırsız varlık, rapor ve abonelik modülü",
    highlight: true,
    features: [
      "Sınırsız varlık",
      "Maliyet analizi ve raporlama",
      "Belge kasası, abonelik ve fatura takibi",
    ],
  },
];

const menuItems = [
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#sablonlar", label: "Şablonlar" },
  { href: "#fiyatlandirma", label: "Fiyatlandırma" },
  { href: "#sss", label: "SSS" },
  { href: "#politikalar", label: "Politikalar" },
];

const operationSteps = [
  {
    title: "Varlık kaydı",
    text: "QR, garanti ve kategori bilgileri tek formda toplanır.",
    badge: "01",
  },
  {
    title: "Bakım kuralı",
    text: "Periyot tanımlanır, sistem bir sonraki tarihi otomatik hesaplar.",
    badge: "02",
  },
  {
    title: "Servis akışı",
    text: "Servis kayıtları maliyet ve belge ile birlikte zaman akışına düşer.",
    badge: "03",
  },
  {
    title: "Risk ve maliyet",
    text: "Dashboard, gecikme ve yaklaşan bakım için net aksiyon üretir.",
    badge: "04",
  },
];

const faqItems: FaqItem[] = [
  {
    question: "AssetCare hangi işletmeler için uygundur?",
    answer:
      "Servis ekibi olan KOBİ'ler, teknik işletmeler, üretim sahaları ve çok lokasyonlu bakım operasyonları için uygundur.",
  },
  {
    question: "Bakım tarihleri otomatik hesaplanıyor mu?",
    answer:
      "Evet. Kural bazlı bakım periyodu tanımlandığında sistem bir sonraki bakım tarihini otomatik hesaplar ve servis sonrası günceller.",
  },
  {
    question: "Abonelik ve fatura takibi nasıl çalışıyor?",
    answer:
      "Abonelik kaydı açıp döngü, tutar ve yenileme tarihi girersiniz. Fatura modülünde durum, vergi, toplam ve ödeme tarihini takip edebilirsiniz.",
  },
  {
    question: "Belgeler güvenli şekilde saklanıyor mu?",
    answer:
      "Evet. Belge kasası private bucket üzerinde çalışır ve erişim politikaları kullanıcı bazlı izolasyonla korunur.",
  },
  {
    question: "Veriler başka kullanıcılar tarafından görülebilir mi?",
    answer:
      "Hayır. RLS politikaları sayesinde her kullanıcı yalnızca kendi verisini görür ve yönetir.",
  },
  {
    question: "Mobilde tüm özellikleri kullanabilir miyim?",
    answer:
      "Evet. Menü, formlar, grafik kartları ve belge akışı mobil ekranlar için optimize edilmiştir.",
  },
  {
    question: "Ücretsiz planın sınırları nelerdir?",
    answer: "Ücretsiz plan en fazla 3 varlıkla temel takip sunar. Premium planda sınır kaldırılır.",
  },
  {
    question: "Premium plan içinde raporlama var mı?",
    answer:
      "Evet. Maliyet analizi, PDF dışa aktarım ve dönem bazlı karşılaştırma raporları Premium plan ile kullanılabilir.",
  },
  {
    question: "Kurulum ne kadar sürer?",
    answer:
      "İlk varlık kayıtları hazırsa çoğu ekip 1 gün içinde canlı kullanıma geçebilir. Formlar hızlı giriş için sade tasarlanmıştır.",
  },
  {
    question: "Destek talebi nasıl oluşturulur?",
    answer:
      "Abonelik talep formunu gönderdiğinizde ekip sizinle iletişime geçer ve ihtiyaçlarınıza göre onboarding adımlarını planlar.",
  },
];

export default function Home() {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>("premium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const selectedPlanDetail = useMemo(
    () => plans.find((plan) => plan.code === selectedPlan) ?? plans[1],
    [selectedPlan],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!fullName || !email) {
      setSubmitMessage("Ad soyad ve e-posta zorunludur.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const response = await fetch("/api/subscription-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          planCode: selectedPlanDetail.apiCode,
          billingCycle: "monthly",
          source: "landing-page",
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitMessage(payload.error ?? "Abonelik talebi alınamadı.");
        return;
      }

      setSubmitMessage("Talebiniz alındı. Kısa süre içinde sizinle iletişime geçeceğiz.");
      form.reset();
    } catch {
      setSubmitMessage("Ağ hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-4">
        <header className="premium-panel motion-fade-up sticky top-4 z-30 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 text-xs font-bold text-white">
                AC
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AssetCare</p>
                <p className="text-sm font-semibold text-white">Varlık Takip SaaS</p>
              </div>
            </Link>

            <ul className="hidden items-center gap-4 text-sm text-slate-300 md:flex">
              {menuItems.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="menu-link rounded-full px-3 py-1.5 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/dashboard" className="menu-link rounded-full px-3 py-1.5 transition hover:text-white">
                  Panel
                </Link>
              </li>
            </ul>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              <Link
                href="/login"
                className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10 sm:flex-none"
              >
                Giriş
              </Link>
              <a
                href="#fiyatlandirma"
                className="flex-1 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90 sm:flex-none"
              >
                Ücretsiz Başla
              </a>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="menu-chip shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                {item.label}
              </a>
            ))}
          </div>
        </header>

        <section className="premium-panel motion-fade-up motion-delay-1 p-6 sm:p-7">
          <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                Güvenli, Ölçülebilir ve Mobil Operasyon
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                Varlık yönetimini
                <br />
                veriyle yöneten kontrol merkezi
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                AssetCare; bakım kurallarını, servis geçmişini, belge kasasını ve abonelik/fatura takibini
                aynı çatı altında birleştirir. Ekipler dağınık tablo yönetimi yerine tek ekrandan net aksiyon alır.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#fiyatlandirma"
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white"
                >
                  Fiyatları Gör
                </a>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Panele Git
                </Link>
              </div>
              <div className="mt-5 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Bakım kural motoru</p>
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Belge kasası ve izleme</p>
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Abonelik ve fatura kontrolü</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {operationSteps.map((step, index) => (
                <OperationCard key={step.badge} step={step} delayClass={`motion-delay-${index + 1}`} />
              ))}
            </div>
          </div>
        </section>

        <section id="ozellikler" className="premium-panel motion-fade-up motion-delay-2 p-7">
          <h2 className="text-2xl font-semibold text-white">Özellikler</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <FeatureCard
              title="Varlık ve Garanti Takibi"
              text="Varlık ekleme, garanti bitiş takibi, durum güncelleme ve QR ile hızlı erişim."
            />
            <FeatureCard
              title="Bakım Kural Motoru"
              text="Periyot bazlı bakım kuralı, otomatik bir sonraki tarih hesabı ve servis sonrası reset."
            />
            <FeatureCard
              title="Maliyet ve Risk Panosu"
              text="Gerçek servis verisinden üretilen maliyet trendi, gecikme ve yaklaşan bakım uyarıları."
            />
          </div>
        </section>

        <section id="sablonlar" className="premium-panel motion-fade-up motion-delay-3 p-7">
          <h2 className="text-2xl font-semibold text-white">Canlı Şablonlar</h2>
          <p className="mt-2 text-sm text-slate-300">
            Menü ve kart geçişleri mobilde de akıcı olacak şekilde optimize edilmiştir.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <TemplateCard
              title="Bakım Öncelik Panosu"
              text="Gecikmiş bakım, yaklaşan bakım ve kural dışı servis kayıtlarını tek kartta toplar."
              accent="from-amber-300/30 to-rose-300/20"
            />
            <TemplateCard
              title="Belge Kasası Akışı"
              text="Yükleme, önizleme ve indirme adımları mobilde tek elle kullanılacak düzende ilerler."
              accent="from-sky-300/30 to-indigo-300/20"
            />
            <TemplateCard
              title="Abonelik Takip Modülü"
              text="Plan durumu, fatura döngüsü ve ödeme görünürlüğü aynı panelde izlenir."
              accent="from-emerald-300/30 to-cyan-300/20"
            />
          </div>
        </section>

        <section id="fiyatlandirma" className="premium-panel motion-fade-up motion-delay-4 p-7">
          <h2 className="text-2xl font-semibold text-white">Fiyatlandırma</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {plans.map((plan) => {
              const selected = selectedPlan === plan.code;
              return (
                <article
                  key={plan.code}
                  className={`rounded-2xl border p-5 transition ${
                    plan.highlight
                      ? "border-fuchsia-300/35 bg-fuchsia-400/10"
                      : "border-white/15 bg-white/5"
                  }`}
                >
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-semibold text-white">{plan.headline}</p>
                  <p className="mt-1 text-sm text-slate-300">{plan.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan.code)}
                    className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      selected
                        ? "bg-gradient-to-r from-sky-400 to-fuchsia-500 text-white"
                        : "border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    {selected ? "Seçili Plan" : "Bu Planı Seç"}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.03] p-5">
            <h3 className="text-xl font-semibold text-white">Abonelik Talebi</h3>
            <p className="mt-2 text-sm text-slate-300">
              Seçilen plan: <strong>{selectedPlanDetail.name}</strong>
            </p>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                name="fullName"
                type="text"
                required
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400"
                placeholder="Ad Soyad"
              />
              <input
                name="email"
                type="email"
                required
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400"
                placeholder="E-posta"
              />
              <input
                name="phone"
                type="tel"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400"
                placeholder="Telefon (Opsiyonel)"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="md:col-span-3 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Gönderiliyor..." : "Abonelik Talebi Gönder"}
              </button>
            </form>
            {submitMessage ? <p className="mt-3 text-sm text-slate-200">{submitMessage}</p> : null}
          </div>
        </section>

        <section id="sss" className="premium-panel motion-fade-up motion-delay-4 p-7">
          <h2 className="text-2xl font-semibold text-white">Sık Sorulan Sorular</h2>
          <p className="mt-2 text-sm text-slate-300">
            Aşağıdaki başlıklara dokunarak detayları açabilirsiniz.
          </p>
          <div className="mt-5 space-y-2">
            {faqItems.map((item, index) => (
              <FaqAccordionItem
                key={item.question}
                item={item}
                isOpen={openFaqIndex === index}
                onToggle={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
              />
            ))}
          </div>
        </section>

        <section id="politikalar" className="premium-panel motion-fade-up motion-delay-4 p-7">
          <h2 className="text-2xl font-semibold text-white">Politikalar ve Yasal Metinler</h2>
          <p className="mt-2 text-sm text-slate-300">
            Hizmet kullanımında şeffaflık için temel politika metinlerimizi buradan inceleyebilirsiniz.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <PolicyLink href="/gizlilik-politikasi" title="Gizlilik Politikası" text="Kişisel verilerin nasıl işlendiği, saklandığı ve korunduğu." />
            <PolicyLink href="/kvkk-aydinlatma" title="KVKK Aydınlatma Metni" text="6698 sayılı KVKK kapsamında veri sorumlusu bilgilendirmesi." />
            <PolicyLink href="/kullanim-kosullari" title="Kullanım Koşulları" text="Hizmetin kullanım şartları, sorumluluklar ve sınırlar." />
            <PolicyLink href="/cerez-politikasi" title="Çerez Politikası" text="Web deneyimini iyileştirmek için kullanılan çerez yönetimi." />
          </div>
        </section>
      </div>
    </main>
  );
}

function OperationCard({
  step,
  delayClass,
}: {
  step: { title: string; text: string; badge: string };
  delayClass: string;
}) {
  return (
    <article className={`premium-card motion-fade-up ${delayClass} hover-lift p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{step.title}</p>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
          {step.badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="line-shimmer h-full w-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500" />
      </div>
    </article>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="premium-card hover-lift p-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </article>
  );
}

function TemplateCard({ title, text, accent }: { title: string; text: string; accent: string }) {
  return (
    <article className="premium-card hover-lift relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
        <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-300" />
        Hareketli kart animasyonu aktif
      </div>
    </article>
  );
}

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white sm:text-base">{item.question}</span>
        <span
          className={`rounded-full border border-white/20 px-2 py-0.5 text-xs text-slate-200 transition ${
            isOpen ? "bg-white/10" : "bg-transparent"
          }`}
        >
          {isOpen ? "Kapat" : "Aç"}
        </span>
      </button>
      {isOpen ? <p className="px-4 pb-4 text-sm leading-6 text-slate-300">{item.answer}</p> : null}
    </article>
  );
}

function PolicyLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="premium-card hover-lift p-4">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </Link>
  );
}
