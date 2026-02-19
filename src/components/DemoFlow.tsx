"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const demoTabs = [
  { id: "asset", label: "Varlık ekle" },
  { id: "risk", label: "Risk hesaplanır" },
  { id: "service", label: "Servis kaydı" },
  { id: "report", label: "Rapor al" },
];

export default function DemoFlow() {
  return (
    <Tabs defaultValue="asset" className="w-full">
      <TabsList
        variant="line"
        className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 md:grid-cols-4"
      >
        {demoTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="rounded-xl border border-transparent bg-transparent px-3 py-2 text-xs text-slate-300 data-[state=active]:border-indigo-400/30 data-[state=active]:bg-indigo-500/10 data-[state=active]:text-white"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="asset" className="mt-4">
        <BrowserFrame title="Yeni Varlık Oluştur">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Varlık adı" value="Samsung TV - Salon" />
              <Input label="Kategori" value="Ev Elektroniği" />
              <Input label="Seri numarası" value="SN-TV-44509" />
              <Input label="Garanti bitiş" value="17.09.2027" />
              <Input label="Satın alma tarihi" value="12.09.2024" />
              <Input label="Satın alma tutarı" value="34.500₺" />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0C152B] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Özet</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>Sonraki bakım: 12.06.2026</p>
                <p>Garanti kalan süre: 19 ay</p>
                <p>Doküman: Fatura + Garanti Belgesi</p>
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Varlığı Kaydet
              </button>
            </div>
          </div>
        </BrowserFrame>
      </TabsContent>

      <TabsContent value="risk" className="mt-4">
        <BrowserFrame title="Risk Skoru ve Öncelik">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard title="Yüksek Risk" value="3" info="30 gün içinde bakım gecikmesi" />
            <MetricCard title="Orta Risk" value="5" info="60 gün içinde servis ihtimali" />
            <MetricCard title="Aylık Tahmini Gider" value="8.900₺" info="Son 12 ay trendine göre" />
          </div>
          <table className="mt-4 w-full overflow-hidden rounded-xl border border-white/10 text-left text-sm">
            <thead className="bg-white/[0.04] text-slate-300">
              <tr>
                <th className="px-3 py-2 font-medium">Varlık</th>
                <th className="px-3 py-2 font-medium">Risk Skoru</th>
                <th className="px-3 py-2 font-medium">Neden</th>
                <th className="px-3 py-2 font-medium">Öneri</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Bosch Buzdolabı</td>
                <td className="px-3 py-2 text-rose-300">82</td>
                <td className="px-3 py-2">Bakım 24 gün gecikti</td>
                <td className="px-3 py-2">Bu hafta servis planla</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Daikin Klima</td>
                <td className="px-3 py-2 text-amber-300">69</td>
                <td className="px-3 py-2">Yıllık bakım yaklaşıyor</td>
                <td className="px-3 py-2">Parça kontrol listesi hazırla</td>
              </tr>
            </tbody>
          </table>
        </BrowserFrame>
      </TabsContent>

      <TabsContent value="service" className="mt-4">
        <BrowserFrame title="Servis Kaydı Oluştur">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-white/10 bg-[#0C152B] p-4">
              <p className="text-sm font-semibold text-white">Yeni Kayıt</p>
              <div className="mt-3 space-y-2">
                <Input label="Servis sağlayıcı" value="Yetkili Samsung Servis" />
                <Input label="İşlem" value="Panel değişimi + genel kontrol" />
                <Input label="Maliyet" value="2.750₺" />
                <Input label="Belge" value="servis-fisi-2026-02.pdf" />
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-white/20 bg-white/[0.02] px-3 py-2 text-sm font-semibold text-slate-100"
              >
                Servis Kaydını Kaydet
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0C152B] p-4">
              <p className="text-sm font-semibold text-white">Son Servis Geçmişi</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">18.02.2026 · Samsung TV · 2.750₺</li>
                <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">02.01.2026 · Bosch Buzdolabı · 1.480₺</li>
                <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">15.12.2025 · Daikin Klima · 3.200₺</li>
              </ul>
            </div>
          </div>
        </BrowserFrame>
      </TabsContent>

      <TabsContent value="report" className="mt-4">
        <BrowserFrame title="Yönetici Raporu">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard title="Toplam Varlık" value="27" info="Aktif takipte" />
            <MetricCard title="Bu Ay Servis" value="9" info="4 planlı, 5 arıza" />
            <MetricCard title="Bu Ay Gider" value="18.450₺" info="Aylık bütçenin %74'ü" />
            <MetricCard title="PDF Durumu" value="Hazır" info="Denetime uygun" />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#0C152B] p-4">
            <p className="text-sm font-semibold text-white">Rapor İçeriği</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Garanti bitiş takvimi</p>
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Bakım gecikme analizi</p>
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Servis maliyet trendi</p>
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Belge erişim logları</p>
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white"
            >
              PDF Raporu İndir
            </button>
          </div>
        </BrowserFrame>
      </TabsContent>
    </Tabs>
  );
}

function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090F1F]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#111827] px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
        </div>
        <p className="text-xs text-slate-300">{title}</p>
      </div>
      <div className="p-4 lg:p-5">{children}</div>
    </div>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return (
    <label className="block rounded-lg border border-white/10 bg-[#0C152B] px-3 py-2">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <span className="mt-1 block text-sm text-slate-100">{value}</span>
    </label>
  );
}

function MetricCard({ title, value, info }: { title: string; value: string; info: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#0C152B] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{info}</p>
    </article>
  );
}
