"use client";

import Link from "next/link";
import { FileUp, FolderPlus, ReceiptText, Wrench } from "lucide-react";
import { FadeInUp, StaggerContainer, StaggerItem } from "@/features/dashboard/components/DashboardAnimations";

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
    <FadeInUp delay={0.05}>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Hızlı Aksiyonlar</h2>
        <StaggerContainer className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4" staggerDelay={0.05}>
          {ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <StaggerItem key={action.title}>
                <Link
                  href={action.href}
                  className="group flex flex-col rounded-2xl border border-[#29405E] bg-[linear-gradient(145deg,rgba(13,27,52,0.9),rgba(10,19,37,0.84))] p-4 shadow-[0_4px_16px_rgba(2,8,20,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#46648B] hover:bg-[linear-gradient(145deg,rgba(16,34,64,0.95),rgba(11,21,40,0.88))] hover:shadow-[0_12px_32px_rgba(2,8,20,0.4)]"
                >
                  <span className="inline-flex rounded-xl border border-[#35517A] bg-[#122846] p-2.5 text-[#C1D7F5] transition-colors duration-200 group-hover:border-[#4A6F9E] group-hover:bg-[#173660]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">{action.title}</h3>
                  <p className="mt-2 text-sm text-[#9FB2CE]">{action.description}</p>
                  <span className="mt-4 inline-flex text-xs font-semibold text-[#D6E6FF] opacity-70 transition-opacity duration-200 group-hover:opacity-100">Aksiyona git</span>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>
    </FadeInUp>
  );
}
