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
    question: "Assetly tam olarak hangi problemi çözer?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Varlıklarınızla ilgili dağınık bilgiyi tek bir kontrol merkezinde toplar; bakım, garanti, maliyet ve belge yönetimini otomatikleştirir.
        </p>
        <p>
          Çoğu kişi ve işletme, sahip olduğu ekipmanların bakım tarihlerini kaçırır, garanti sürelerini fark edemez, abonelik ödemelerini kontrol edemez. Sonuç: gereksiz harcamalar, beklenmedik arızalar ve kaybolan belgeler. Assetly bu kaosun tamamını tek bir akıllı panelde çözer — ne zaman aksiyon almanız gerektiğini size söyler, siz hatırlamak zorunda kalmazsınız.
        </p>
      </>
    ),
  },
  {
    question: "Assetly kimler için tasarlandı?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evindeki beyaz eşyayı takip etmek isteyen bireylerden, yüzlerce ekipmanı yöneten işletmelere kadar herkes için.
        </p>
        <p>
          Tipik kullanıcılarımız: kendi ev ve ofis ekipmanlarını düzenli tutmak isteyen bireyler, araç filolarını ve sahada kullanılan cihazları yöneten küçük-orta işletmeler, abonelik ve lisans giderlerini kontrol altında tutmak isteyen freelancer&apos;lar ve startup&apos;lar. Ortak nokta: &quot;Elimdeki şeylerin durumunu, maliyetini ve bir sonraki adımını bilmek istiyorum.&quot;
        </p>
      </>
    ),
  },
  {
    question: "Neden Excel tablosu veya Notion yerine Assetly kullanmalıyım?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Tablolar veri depolar ama sizi uyarmaz, analiz etmez, otomatik aksiyon almaz.
        </p>
        <p>
          Excel&apos;de bir bakım tarihini yazabilirsiniz — ama o tarih geldiğinde sizi kim uyaracak? Notion&apos;da bir garanti belgesini saklayabilirsiniz — ama süre dolmadan 30 gün önce kim hatırlatacak? Assetly verinin ötesine geçer: bakım zamanı geldiğinde bildirim gönderir, garanti bitiş tarihini izler, varlıklarınızın sağlık skorunu hesaplar ve &quot;şu an dikkat etmeniz gereken 3 şey var&quot; diyebilir. Tablo bir araçtır; Assetly bir sistemdir.
        </p>
      </>
    ),
  },
  {
    question: "Varlık takibi pratikte nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Varlığınızı ekleyin, detaylarını girin, gerisini Assetly yönetsin.
        </p>
        <p>
          Bir varlık eklediğinizde; satın alma tarihi, garanti süresi, bakım periyodu, maliyet ve ilgili belgeleri kaydedersiniz. Assetly bu verileri kullanarak otomatik bakım takvimi oluşturur, garanti bitiş uyarıları planlar ve varlığın genel sağlık skorunu hesaplar. Her servis kaydı, belge yüklemesi veya durum değişikliği varlığın yaşam döngüsüne eklenir.
        </p>
      </>
    ),
  },
  {
    question: "Hangi tür varlıkları takip edebilirim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Fiziksel veya dijital, fark etmez — değer taşıyan ve takip gerektiren her şey.
        </p>
        <p>
          Beyaz eşya, elektronik cihazlar, araçlar, ofis ekipmanları, endüstriyel makineler, yazılım lisansları, dijital abonelikler, sigorta poliçeleri, kira sözleşmeleri… Assetly&apos;nin esnek yapısı, herhangi bir varlık türünü özel kategoriler ve alanlarla tanımlamanıza olanak tanır.
        </p>
      </>
    ),
  },
  {
    question: "Verilerim güvende mi?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Verileriniz endüstri standardı güvenlik altyapısıyla korunur ve yalnızca size aittir.
        </p>
        <p>
          Tüm veri iletişimi TLS ile şifrelenir, veritabanında satır düzeyinde güvenlik politikaları (RLS) aktiftir ve her kullanıcının verileri birbirinden tam izole edilmiştir. Belgeleriniz özel depolama alanında, yalnızca sizin erişebileceğiniz şekilde saklanır. Hiçbir üçüncü taraf, izniniz olmadan verilerinize erişemez.
        </p>
      </>
    ),
  },
  {
    question: "Hatırlatmalar ve otomasyonlar nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Assetly kritik tarihleri ve eşikleri izler; harekete geçmeniz gerektiğinde sizi proaktif olarak bilgilendirir.
        </p>
        <p>
          Bakım periyotları, garanti bitiş tarihleri, abonelik yenileme zamanları ve belge son kullanma tarihleri sürekli takip edilir. Bir varlığa 6 aylık bakım periyodu tanımladıysanız, her döngü sonunda bildirim alırsınız. Garanti bitmeden önce uyarılırsınız. Hiçbir kritik tarihi hatırlamanız gerekmez.
        </p>
      </>
    ),
  },
  {
    question: "Varlık skor sistemi nedir ve neden önemli?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Her varlığınıza durumunu özetleyen bir sağlık skoru atanır — böylece hangisine öncelik vermeniz gerektiğini anında görürsünüz.
        </p>
        <p>
          Skor; bakım düzeni, garanti durumu, yaş, servis geçmişi ve kullanıcı girdileri dikkate alınarak hesaplanır. Düzenli bakımı yapılan, garantisi devam eden bir varlık yüksek skor alır; bakımı gecikmiş, garantisi bitmiş bir varlık düşük skor alır. 3 varlık yönetirken gereksiz görünebilir — ama 30 veya 300 varlık yönettiğinizde &quot;ilk hangisine bakmalıyım?&quot; sorusunun cevabını saniyeler içinde verir.
        </p>
      </>
    ),
  },
  {
    question: "Abonelik ve faturaları varlıklarla birlikte yönetebilir miyim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Evet. Fiziksel varlıklar kadar dijital abonelikleri ve tekrarlayan giderleri de tek panelde yönetebilirsiniz.
        </p>
        <p>
          Yazılım lisansları, SaaS abonelikleri, sigorta poliçeleri veya periyodik bakım sözleşmeleri — hepsini varlık olarak tanımlayabilir, maliyetlerini izleyebilir ve yenileme tarihlerini otomatik takip edebilirsiniz.
        </p>
      </>
    ),
  },
  {
    question: "Bir şeyi güncellemeyi unutursam ne olur?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Assetly sizi uyarır — unutmak, sistemin tasarlandığı problemlerden biridir.
        </p>
        <p>
          Bakım kaydını girmediniz mi? Sistem, planlanan tarihi geçtiğinde sizi bilgilendirir ve varlığın skor puanı otomatik olarak düşer. Garanti belgesini yüklemediniz mi? Eksik belge uyarısı görürsünüz. Assetly pasif bir kayıt defteri değildir — veri eksikliğini tespit eder ve dikkatinizi çeker.
        </p>
      </>
    ),
  },
  {
    question: "Ücretsiz planda kaç varlık ekleyebilirim?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Ücretsiz planda en fazla 3 varlık ekleyebilirsiniz.
        </p>
        <p>
          Bu limit, platformu tanımanız ve temel özellikleri deneyimlemeniz için tasarlanmıştır. Daha fazla varlık, gelişmiş bildirimler, detaylı raporlama ve belge kasası için Premium plana geçiş yapabilirsiniz.
        </p>
      </>
    ),
  },
  {
    question: `Premium plan ne kadara mal olur?`,
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Premium plan ücreti {PREMIUM_MONTHLY_PRICE_LABEL}/ay olarak uygulanır ve aylık döngüyle faturalandırılır.
        </p>
        <p>
          Premium ile sınırsız varlık takibi, gelişmiş otomasyon, skor analizi, belge kasası ve öncelikli desteğe erişirsiniz. Tasarruf ettiğiniz zaman ve önlediğiniz hatalar düşünüldüğünde, yatırımın geri dönüşü ilk aydan itibaren hissedilir.
        </p>
      </>
    ),
  },
  {
    question: "Aboneliğimi iptal edersem verilerim hemen silinir mi?",
    answer: (
      <>
        <p className="font-medium text-slate-100">
          Hayır. İptal işlemi sonraki yenilemeyi durdurur; verileriniz anlık olarak silinmez.
        </p>
        <p>
          Veri saklama ve silme süreçleri yasal yükümlülükler ile veri silme politikası kapsamında yürütülür. İptal sonrasında mevcut dönem sonuna kadar Premium özelliklerine erişmeye devam edersiniz.
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
          Talep içeriğine hesap bilgilerinizi ve yaşadığınız senaryoyu eklemeniz çözüm sürecini hızlandırır. Premium kullanıcılar öncelikli destek kuyruğundan yararlanır.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: "SSS | Assetly",
  description: "Assetly hakkında en çok sorulan sorular: güvenlik, planlar, veri yönetimi, otomasyon ve platform kullanımı.",
};

export default function FaqPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly SSS</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sık Sorulan Sorular</h1>
        <p className="text-sm leading-7 text-slate-300">
          Karar vermeden önce bilmeniz gereken her şey — planlar, güvenlik, otomasyon, veri yönetimi ve platform kullanımı
          hakkında açık yanıtlar.
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


