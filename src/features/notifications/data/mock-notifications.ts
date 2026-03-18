export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";
export type NotificationStatus = "Okundu" | "Okunmadı";

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  detail?: string;
  createdAt: string;
  status: NotificationStatus;
  source: "automation" | "mock";
  actionHref?: string;
  actionLabel?: string;
};

const toIsoDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const mockNotifications: NotificationRecord[] = [
  {
    id: "mock-1",
    type: "Bakım",
    title: "Bakım zamanı yaklaşıyor",
    description: "Salon Kombi varlığınız için planlı bakım tarihine 7 gün kaldı.",
    createdAt: toIsoDaysAgo(1),
    status: "Okunmadı",
    source: "mock",
    actionHref: "/maintenance",
    actionLabel: "Detaylara Bak",
  },
  {
    id: "mock-2",
    type: "Garanti",
    title: "Garanti bitiş tarihi yaklaşıyor",
    description: "Arçelik 5786 model varlığınız için garanti bitiş tarihine 30 gün kaldı.",
    createdAt: toIsoDaysAgo(3),
    status: "Okunmadı",
    source: "mock",
    actionHref: "/assets",
    actionLabel: "Detaylara Bak",
  },
  {
    id: "mock-3",
    type: "Belge",
    title: "Belgeyle ilgili bir işlem bekliyor",
    description: "Kombi varlığınız için servis formu belgesi gözden geçirilmeyi bekliyor.",
    createdAt: toIsoDaysAgo(4),
    status: "Okundu",
    source: "mock",
    actionHref: "/documents",
    actionLabel: "Detaylara Bak",
  },
  {
    id: "mock-4",
    type: "Ödeme",
    title: "Ödeme tarihi yaklaşıyor",
    description: "Doğalgaz Plus aboneliğiniz için tahsilat tarihi bugün.",
    createdAt: toIsoDaysAgo(2),
    status: "Okunmadı",
    source: "mock",
    actionHref: "/billing",
    actionLabel: "Detaylara Bak",
  },
  {
    id: "mock-5",
    type: "Sistem",
    title: "Sistem bildirimi",
    description: "Takip etmeniz gereken yeni bir gelişme var.",
    createdAt: toIsoDaysAgo(7),
    status: "Okundu",
    source: "mock",
  },
];
