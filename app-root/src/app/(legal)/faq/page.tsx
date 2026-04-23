import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";

interface FaqItemType {
  question: string;
  answer: ReactNode;
}

const faqItems: FaqItemType[] = [
  {
    question: "Ücretsiz plan ne içerir?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Ücretsiz planda en fazla 3 varlık ekleyebilir ve temel takip özelliklerini kullanabilirsiniz.
        </p>
        <p>
          Bu limit, platformu tanımanız ve temel özellikleri deneyimlemeniz için tasarlanmıştır.
          Sınırsız varlık, gelişmiş bildirimler, detaylı raporlama ve belge kasası gibi özellikler
          Premium plana dahildir.
        </p>
      </>
    ),
  },
  {
    question: "Premium plan ücreti nedir?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Premium plan ücreti {PREMIUM_MONTHLY_PRICE_LABEL}/ay olarak uygulanır ve aylık döngüyle faturalandırılır.
        </p>
        <p>
          Premium ile sınırsız varlık takibi, gelişmiş bildirimler, skor analizi, belge kasası ve
          öncelikli desteğe erişirsiniz. Fiyatlandırma detaylarına hesap ayarları veya fiyatlandırma
          sayfasından ulaşabilirsiniz.
        </p>
      </>
    ),
  },
  {
    question: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Ödemeler Stripe altyapısı üzerinden güvenli şekilde işlenir.
        </p>
        <p>
          Kredi kartı ve banka kartı ile ödeme yapabilirsiniz. Tüm ödeme bilgileri Assetly
          sunucularında saklanmaz; doğrudan Stripe tarafından PCI DSS standartlarına uygun
          olarak işlenir.
        </p>
      </>
    ),
  },
  {
    question: "Aboneliğimi nasıl iptal ederim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Aboneliğinizi hesap ayarlarından istediğiniz zaman iptal edebilirsiniz.
        </p>
        <p>
          İptal işlemi bir sonraki yenilemeyi durdurur. Mevcut faturalandırma dönemi sonuna kadar
          Premium özelliklerine erişmeye devam edersiniz. İptal sonrasında hesabınız otomatik olarak
          ücretsiz plana döner.
        </p>
      </>
    ),
  },
  {
    question: "İptal sonrasında verilerime ne olur?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Verileriniz iptal sonrasında anlık olarak silinmez.
        </p>
        <p>
          Hesabınız ücretsiz plana döndüğünde mevcut verileriniz korunur; ancak ücretsiz plan
          limitlerini aşan özellikler kısıtlanır. Veri saklama ve silme süreçleri yasal yükümlülükler
          ile veri silme politikamız kapsamında yürütülür.
        </p>
      </>
    ),
  },
  {
    question: "İade politikanız nedir?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Abonelik ücretleri için standart iade politikamız geçerlidir.
        </p>
        <p>
          Detaylı iade koşulları için hizmet şartları sayfamızı inceleyebilir veya destek ekibimize
          başvurabilirsiniz. İptal işlemi bir sonraki dönemden itibaren faturalandırmayı durdurur.
        </p>
      </>
    ),
  },
  {
    question: "Verilerim nerede ve nasıl saklanır?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Verileriniz endüstri standardı güvenlik önlemleriyle korunan bulut altyapısında saklanır.
        </p>
        <p>
          Tüm veri iletişimi TLS ile şifrelenir. Veritabanında her kullanıcının verileri birbirinden
          izole edilmiştir. Belgeleriniz özel depolama alanında, yalnızca sizin erişebileceğiniz şekilde
          saklanır. Üçüncü taraflarla izniniz olmadan veri paylaşımı yapılmaz.
        </p>
      </>
    ),
  },
  {
    question: "Hangi kişisel veriler toplanır?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Hesap oluşturma ve hizmet sunumu için gerekli olan minimum düzeyde kişisel veri toplanır.
        </p>
        <p>
          E-posta adresi, hesap tercihleri ve kullanım istatistikleri temel toplanan verilerdir.
          Varlıklarınıza ait bilgiler yalnızca size hizmet sunmak amacıyla saklanır. Detaylı bilgi
          için gizlilik politikamızı inceleyebilirsiniz.
        </p>
      </>
    ),
  },
  {
    question: "Verilerimi dışa aktarabilir miyim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Yetkili kullanıcılar varlık kayıtları ve bakım geçmişi için dışa aktarma işlemi yapabilir.
        </p>
        <p>
          Dışa aktarma seçeneklerine hesap ayarlarından veya ilgili raporlama ekranlarından
          erişebilirsiniz. Veri taşınabilirliği hakkınız gizlilik politikamız kapsamında
          desteklenmektedir.
        </p>
      </>
    ),
  },
  {
    question: "Hesabımı kalıcı olarak silebilir miyim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Hesap silme talebinizi destek ekibimize iletebilirsiniz.
        </p>
        <p>
          Hesap silindiğinde tüm kişisel verileriniz ve varlık kayıtlarınız kalıcı olarak kaldırılır.
          Bu işlem geri alınamaz. Silme öncesinde verilerinizi dışa aktarmanızı öneririz.
        </p>
      </>
    ),
  },
  {
    question: "Belge kasası güvenli mi?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Belgeler kullanıcı izolasyonu ve erişim kontrolleriyle korunur.
        </p>
        <p>
          Her kullanıcının belgeleri özel depolama politikalarıyla ayrılmıştır. Dosyalara yalnızca
          yetkili kullanıcılar erişebilir. Belge kasası Premium plana dahildir.
        </p>
      </>
    ),
  },
  {
    question: "Birden fazla kullanıcı aynı hesabı yönetebilir mi?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Ekip üyeleri role göre davet edilebilir.
        </p>
        <p>
          Görüntüleme, düzenleme ve yönetim yetkileri hesap yöneticisi tarafından kontrol edilir.
          Hassas verilere yalnızca yetkili kişiler erişir.
        </p>
      </>
    ),
  },
  {
    question: "QR kod özelliği ne işe yarıyor?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          QR kodlar, ilgili varlık kartına hızlı erişim sağlar.
        </p>
        <p>
          Saha ekipleri cihaz geçmişi, bakım durumu ve belge kayıtlarına tek taramayla ulaşabilir.
          QR kod özelliği Premium plana dahildir.
        </p>
      </>
    ),
  },
  {
    question: "Fatura geçmişime nereden ulaşırım?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Abonelik ve fatura kayıtlarına faturalama ekranından erişebilirsiniz.
        </p>
        <p>
          Yetkili hesap sahipleri geçmiş dönem faturaları görüntüleyebilir ve indirebilir.
          Faturalama işlemleri Stripe üzerinden yönetilir.
        </p>
      </>
    ),
  },
  {
    question: "Destek talebi nasıl oluştururum?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Destek taleplerinizi hesap içinden veya assetly@gmail.com adresi üzerinden iletebilirsiniz.
        </p>
        <p>
          Talep içeriğine hesap bilgilerinizi ve yaşadığınız senaryoyu eklemeniz çözüm sürecini
          hızlandırır. Premium kullanıcılar öncelikli destek kuyruğundan yararlanır.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: "SSS | Assetly",
  description: "Assetly hesap yönetimi, planlar, faturalama, güvenlik ve veri politikaları hakkında sık sorulan sorular.",
};

export default function FaqPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly Yardım</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sık Sorulan Sorular</h1>
        <p className="text-sm leading-7 text-slate-300">
          Hesap yönetimi, planlar, faturalama, güvenlik ve veri politikaları hakkında
          açık yanıtlar.
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
              <div className="space-y-3 border-l-2 border-indigo-500/70 pl-4">{item.answer}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </article>
  );
}


