import Link from "next/link";
import { FileUp, FolderPlus, ReceiptText, Wrench } from "lucide-react";

type ActionItem = {
  href: string;
  title: string;
  description: string;
  icon: typeof FolderPlus;
};

const ACTIONS: ActionItem[] = [
  {
    href: "/assets",
    title: "Varlık Ekle",
    description: "Yeni varlık kaydı oluştur ve takibi hemen başlat.",
    icon: FolderPlus,
  },
  {
    href: "/maintenance",
    title: "Bakım Kuralı Oluştur",
    description: "Periyodik bakım düzenini dakikalar içinde tanımla.",
    icon: Wrench,
  },
  {
    href: "/services",
    title: "Servis Kaydı Ekle",
    description: "Yapılan işlemleri maliyetleriyle birlikte kaydet.",
    icon: ReceiptText,
  },
  {
    href: "/documents",
    title: "Belge Yükle",
    description: "Garanti, fatura ve servis dokümanlarını arşivle.",
    icon: FileUp,
  },
];

export function QuickActions() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#F8FAFC]">Hızlı Aksiyonlar</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.title}
              href={action.href}
              className="group rounded-2xl border border-[#29405E] bg-[linear-gradient(145deg,rgba(13,27,52,0.9),rgba(10,19,37,0.84))] p-4 shadow-[0_16px_34px_rgba(2,8,20,0.34)] transition hover:-translate-y-0.5 hover:border-[#46648B] hover:bg-[linear-gradient(145deg,rgba(16,34,64,0.95),rgba(11,21,40,0.88))]"
            >
              <span className="inline-flex rounded-xl border border-[#35517A] bg-[#122846] p-2 text-[#C1D7F5]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">{action.title}</h3>
              <p className="mt-2 text-sm text-[#9FB2CE]">{action.description}</p>
              <span className="mt-4 inline-flex text-xs font-semibold text-[#D6E6FF]">Aksiyona git</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
