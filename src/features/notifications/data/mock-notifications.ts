export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";
export type NotificationStatus = "Okundu" | "Okunmadı";

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  status: NotificationStatus;
  source: "automation" | "mock";
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
    title: "Kombi yıllık bakım zamanı yaklaşıyor",
    description: "Salon Kombi için planlı bakım tarihine 7 gün kaldı.",
    createdAt: toIsoDaysAgo(1),
    status: "Okunmadı",
    source: "mock",
  },
  {
    id: "mock-2",
    type: "Garanti",
    title: "Buzdolabı garantisi yakında bitiyor",
    description: "Arçelik 5786 model cihaz için garanti bitiş tarihine 30 gün kaldı.",
    createdAt: toIsoDaysAgo(3),
    status: "Okunmadı",
    source: "mock",
  },
  {
    id: "mock-3",
    type: "Belge",
    title: "Belge yükleme hatırlatması",
    description: "Kombi servis raporu belgesi eksik görünüyor. Dosya yükleyerek kaydı tamamlayın.",
    createdAt: toIsoDaysAgo(4),
    status: "Okundu",
    source: "mock",
  },
  {
    id: "mock-4",
    type: "Ödeme",
    title: "Abonelik ödemesi bugün",
    description: "Doğalgaz Plus aboneliğinin tahsilat tarihi bugün. Gecikme yaşamamak için kontrol edin.",
    createdAt: toIsoDaysAgo(2),
    status: "Okunmadı",
    source: "mock",
  },
  {
    id: "mock-5",
    type: "Sistem",
    title: "Otomasyon kuralı güncellendi",
    description: "Bakım tetikleyicisi başarıyla güncellendi. Yeni eşik ayarları aktif edildi.",
    createdAt: toIsoDaysAgo(7),
    status: "Okundu",
    source: "mock",
  },
];

