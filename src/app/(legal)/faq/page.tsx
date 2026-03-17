import type { Metadata } from "next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";

const faqItems = [
  {
    question: "Ãœcretsiz planda kaÃ§ varlÄ±k ekleyebilirim?",
    answer: "Ãœcretsiz planda en fazla 3 varlÄ±k ekleyebilirsiniz. Daha yÃ¼ksek kapasite iÃ§in Premium plana geÃ§iÅŸ yapÄ±labilir.",
  },
  {
    question: "Premium plan ne kadara mal olur?",
    answer: `Premium plan \u00fcreti ${PREMIUM_MONTHLY_PRICE_LABEL}/ay olarak uygulan\u0131r ve ayl\u0131k d\u00f6ng\u00fcyle faturaland\u0131r\u0131l\u0131r.`,
  },
  {
    question: "Verilerimi export edebilir miyim?",
    answer:
      "Evet. Yetkili kullanÄ±cÄ±lar varlÄ±k kayÄ±tlarÄ±, bakÄ±m geÃ§miÅŸi ve belirli rapor Ã§Ä±ktÄ±larÄ± iÃ§in dÄ±ÅŸa aktarma iÅŸlemi yapabilir.",
  },
  {
    question: "Garanti sÃ¼resi bitmeden uyarÄ± alÄ±r mÄ±yÄ±m?",
    answer:
      "Evet. Garanti bitiÅŸ tarihi yaklaÅŸan varlÄ±klar iÃ§in sistemde bildirim Ã¼retilebilir; bÃ¶ylece Ã¶nleyici aksiyon alÄ±nÄ±r.",
  },
  {
    question: "QR kod Ã¶zelliÄŸi ne iÅŸe yarÄ±yor?",
    answer:
      "QR kodlar, ilgili varlÄ±k kartÄ±na hÄ±zlÄ± eriÅŸim saÄŸlar. Saha ekipleri cihaz geÃ§miÅŸi, bakÄ±m durumu ve belge kayÄ±tlarÄ±na tek taramayla ulaÅŸabilir.",
  },
  {
    question: "Belge kasasÄ± gÃ¼venli mi?",
    answer:
      "Belgeler tenant izolasyonu, eriÅŸim yetkileri ve Ã¶zel depolama politikalarÄ±yla korunur. Dosyalara yalnÄ±zca yetkili kullanÄ±cÄ±lar eriÅŸebilir.",
  },
  {
    question: "Birden fazla kullanÄ±cÄ± aynÄ± hesabÄ± yÃ¶netebilir mi?",
    answer:
      "Evet. Ekip Ã¼yeleri role gÃ¶re davet edilebilir; gÃ¶rÃ¼ntÃ¼leme, dÃ¼zenleme ve yÃ¶netim yetkileri hesap yÃ¶neticisi tarafÄ±ndan kontrol edilir.",
  },
  {
    question: "BakÄ±m planlarÄ±nÄ± otomatikleÅŸtirebilir miyim?",
    answer:
      "Evet. Periyodik bakÄ±m kurallarÄ± tanÄ±mlanarak bir sonraki bakÄ±m tarihi otomatik hesaplanÄ±r ve takip sÃ¼reci standartlaÅŸtÄ±rÄ±lÄ±r.",
  },
  {
    question: "Fatura geÃ§miÅŸime nereden ulaÅŸÄ±rÄ±m?",
    answer:
      "Abonelik ve fatura kayÄ±tlarÄ±na faturalama ekranÄ±ndan eriÅŸebilirsiniz. Yetkili hesap sahipleri geÃ§miÅŸ dÃ¶nem faturalarÄ± gÃ¶rÃ¼ntÃ¼leyebilir.",
  },
  {
    question: "AboneliÄŸimi iptal edersem verilerim hemen silinir mi?",
    answer:
      "HayÄ±r. Ä°ptal iÅŸlemi sonraki yenilemeyi durdurur; veri saklama ve silme sÃ¼reÃ§leri yasal yÃ¼kÃ¼mlÃ¼lÃ¼kler ile veri silme politikasÄ± kapsamÄ±nda yÃ¼rÃ¼tÃ¼lÃ¼r.",
  },
  {
    question: "Mobil cihazdan kullanabilir miyim?",
    answer:
      "Evet. ArayÃ¼z mobil uyumludur ve temel yÃ¶netim iÅŸlemleri telefon veya tablet Ã¼zerinden gerÃ§ekleÅŸtirilebilir.",
  },
  {
    question: "Destek talebi nasÄ±l oluÅŸtururum?",
    answer:
      "Destek taleplerinizi hesap iÃ§inden veya assetly@gmail.com adresi Ã¼zerinden iletebilirsiniz. Talep iÃ§eriÄŸine hesap ve senaryo detaylarÄ±nÄ± eklemeniz Ã§Ã¶zÃ¼m sÃ¼recini hÄ±zlandÄ±rÄ±r.",
  },
];

export const metadata: Metadata = {
  title: "SSS | Assetly",
  description: "Assetly hakkÄ±nda sÄ±k sorulan sorular ve kullanÄ±m yanÄ±tlarÄ±.",
};

export default function FaqPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">SÄ±k Sorulan Sorular (SSS)</h1>
        <p className="text-sm leading-7 text-slate-300">
          AÅŸaÄŸÄ±daki sorular, planlar, gÃ¼venlik yaklaÅŸÄ±mÄ±, veri yÃ¶netimi ve platform kullanÄ±mÄ± hakkÄ±nda en sÄ±k ihtiyaÃ§
          duyulan aÃ§Ä±klamalarÄ± iÃ§erir.
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


