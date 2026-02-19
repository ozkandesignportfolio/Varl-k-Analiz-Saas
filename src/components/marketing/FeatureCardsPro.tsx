import { Bell, FileDown, FileText, ShieldCheck, Wallet, Wrench } from "lucide-react";
import Surface from "@/components/ui/Surface";

const items = [
  { icon: ShieldCheck, t: "Kanıt Zinciri", d: "Servis + belge + kayıt bağlantılı" },
  { icon: Wrench, t: "Bakım Motoru", d: "Periyot ve risk hesaplar" },
  { icon: FileText, t: "Servis Günlüğü", d: "Tarihçeyi kanıtlı tutar" },
  { icon: Wallet, t: "Maliyet Paneli", d: "Toplam ve yıllık gider" },
  { icon: Bell, t: "Akıllı Uyarı", d: "Yaklaşan bakım bildirimi" },
  { icon: FileDown, t: "PDF Rapor", d: "Yaşam döngüsü çıktısı" },
];

export default function FeatureCardsPro() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((x, i) => {
        const Icon = x.icon;
        return (
          <Surface key={i}>
            <Icon className="mb-3 h-6 w-6" />
            <div className="font-semibold">{x.t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{x.d}</div>
          </Surface>
        );
      })}
    </div>
  );
}
