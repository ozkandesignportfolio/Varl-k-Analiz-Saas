import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Assetly",
  description: "6698 sayılı KVKK kapsamında Assetly kişisel veri aydınlatma metni.",
};

export default function KvkkPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">KVKK Aydınlatma Metni</h1>
        <p className="text-sm leading-7 text-slate-300">
          Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri işleme faaliyetleri
          hakkında ilgili kişileri bilgilendirmek amacıyla hazırlanmıştır.
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Son güncelleme: 18 Şubat 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Veri Sorumlusu</h2>
        <p className="leading-7 text-slate-300">
          Assetly, hesap yönetimi, güvenlik denetimi, abonelik ve destek süreçleri bakımından veri sorumlusu
          sıfatıyla hareket eder. Müşteri şirketlerce sisteme girilen kurumsal operasyon verilerinde, Assetly veri
          işleyen olarak hizmet sunar.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">İşlenen Veriler</h2>
        <p className="leading-7 text-slate-300">
          Kimlik ve iletişim verileri, kullanıcı rol bilgileri, varlık ve bakım kayıtları, doküman yüklemeleri, fatura
          verileri, işlem güvenliği logları ve destek taleplerine ilişkin bilgiler işlenebilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Hukuki Dayanak</h2>
        <p className="leading-7 text-slate-300">
          Veriler; sözleşmenin kurulması veya ifası, veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi, bir
          hakkın tesisi/kullanılması/korunması ve meşru menfaat hukuki sebeplerine dayanılarak işlenir. Açık rıza
          gerektiren durumlarda ayrıca rıza alınır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Aktarım</h2>
        <p className="leading-7 text-slate-300">
          Kişisel veriler, hizmetin ifası için zorunlu altyapı tedarikçilerine, ödeme ve e-posta servis sağlayıcılarına
          KVKK&apos;ya uygun teknik ve idari tedbirlerle aktarılabilir. Yetkili kamu kurumlarına aktarım, yalnızca yasal
          zorunluluk halinde yapılır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Saklama Süresi</h2>
        <p className="leading-7 text-slate-300">
          Veriler, ilgili mevzuatta öngörülen veya işleme amacının gerektirdiği süre boyunca saklanır. Süre sonunda
          veriler silinir, yok edilir veya anonim hale getirilir. Zorunlu mali kayıtlar yasal saklama süreleri boyunca
          korunur.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Haklarınız (Madde 11)</h2>
        <p className="leading-7 text-slate-300">
          KVKK Madde 11 uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme,
          amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış
          işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme ve zarara uğramanız halinde tazminat
          talep etme haklarına sahipsiniz.
        </p>
        <p className="leading-7 text-slate-300">
          Başvurularınızı{" "}
          <a href="mailto:assetly@gmail.com" className="text-indigo-300 underline underline-offset-2">
            assetly@gmail.com
          </a>{" "}
          adresine iletebilirsiniz.
        </p>
      </section>
    </article>
  );
}
