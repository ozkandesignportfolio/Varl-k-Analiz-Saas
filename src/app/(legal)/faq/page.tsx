import type { Metadata } from "next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Ücretsiz planda kaç varlık ekleyebilirim?",
    answer: "Ücretsiz planda en fazla 3 varlık ekleyebilirsiniz. Daha yüksek kapasite için Premium plana geçiş yapılabilir.",
  },
  {
    question: "Premium plan ne kadara mal olur?",
    answer: "Premium plan ücreti 149 TL/ay olarak uygulanır ve aylık döngüyle faturalandırılır.",
  },
  {
    question: "Verilerimi export edebilir miyim?",
    answer:
      "Evet. Yetkili kullanıcılar varlık kayıtları, bakım geçmişi ve belirli rapor çıktıları için dışa aktarma işlemi yapabilir.",
  },
  {
    question: "Garanti süresi bitmeden uyarı alır mıyım?",
    answer:
      "Evet. Garanti bitiş tarihi yaklaşan varlıklar için sistemde bildirim üretilebilir; böylece önleyici aksiyon alınır.",
  },
  {
    question: "QR kod özelliği ne işe yarıyor?",
    answer:
      "QR kodlar, ilgili varlık kartına hızlı erişim sağlar. Saha ekipleri cihaz geçmişi, bakım durumu ve belge kayıtlarına tek taramayla ulaşabilir.",
  },
  {
    question: "Belge kasası güvenli mi?",
    answer:
      "Belgeler tenant izolasyonu, erişim yetkileri ve özel depolama politikalarıyla korunur. Dosyalara yalnızca yetkili kullanıcılar erişebilir.",
  },
  {
    question: "Birden fazla kullanıcı aynı hesabı yönetebilir mi?",
    answer:
      "Evet. Ekip üyeleri role göre davet edilebilir; görüntüleme, düzenleme ve yönetim yetkileri hesap yöneticisi tarafından kontrol edilir.",
  },
  {
    question: "Bakım planlarını otomatikleştirebilir miyim?",
    answer:
      "Evet. Periyodik bakım kuralları tanımlanarak bir sonraki bakım tarihi otomatik hesaplanır ve takip süreci standartlaştırılır.",
  },
  {
    question: "Fatura geçmişime nereden ulaşırım?",
    answer:
      "Abonelik ve fatura kayıtlarına faturalama ekranından erişebilirsiniz. Yetkili hesap sahipleri geçmiş dönem faturaları görüntüleyebilir.",
  },
  {
    question: "Aboneliğimi iptal edersem verilerim hemen silinir mi?",
    answer:
      "Hayır. İptal işlemi sonraki yenilemeyi durdurur; veri saklama ve silme süreçleri yasal yükümlülükler ile veri silme politikası kapsamında yürütülür.",
  },
  {
    question: "Mobil cihazdan kullanabilir miyim?",
    answer:
      "Evet. Arayüz mobil uyumludur ve temel yönetim işlemleri telefon veya tablet üzerinden gerçekleştirilebilir.",
  },
  {
    question: "Destek talebi nasıl oluştururum?",
    answer:
      "Destek taleplerinizi hesap içinden veya assetly@gmail.com adresi üzerinden iletebilirsiniz. Talep içeriğine hesap ve senaryo detaylarını eklemeniz çözüm sürecini hızlandırır.",
  },
];

export const metadata: Metadata = {
  title: "SSS | Assetly",
  description: "Assetly hakkında sık sorulan sorular ve kullanım yanıtları.",
};

export default function FaqPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sık Sorulan Sorular (SSS)</h1>
        <p className="text-sm leading-7 text-slate-300">
          Aşağıdaki sorular, planlar, güvenlik yaklaşımı, veri yönetimi ve platform kullanımı hakkında en sık ihtiyaç
          duyulan açıklamaları içerir.
        </p>
      </header>

      <Accordion type="single" collapsible className="space-y-3">
        {faqItems.map((item, index) => (
          <AccordionItem
            key={item.question}
            value={`faq-${index + 1}`}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5"
          >
            <AccordionTrigger className="py-5 text-base font-medium text-slate-100 hover:no-underline [&[data-state=open]_.indicator]:scale-125 [&[data-state=open]_.indicator]:bg-indigo-300">
              <span className="flex items-start gap-3 pr-3">
                <span className="indicator mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 transition-all duration-300" />
                <span>{item.question}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm leading-7 text-slate-300">
              <p className="border-l-2 border-indigo-500/70 pl-4">{item.answer}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </article>
  );
}
