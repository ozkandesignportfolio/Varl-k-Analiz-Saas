"use client";

import { BellOff } from "lucide-react";
import { NotificationItem } from "@/features/notifications/components/NotificationItem";
import type { NotificationRecord } from "@/features/notifications/data/mock-notifications";

type NotificationsListProps = {
  items: NotificationRecord[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
};

export function NotificationsList({ items, isLoading, onMarkRead, onDelete }: NotificationsListProps) {
  if (isLoading) {
    return (
      <section className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article
            key={`loading-${index}`}
            className="premium-card h-28 animate-pulse border-white/10 bg-white/[0.03]"
          />
        ))}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="premium-card border-dashed border-white/20 bg-white/[0.02] p-8 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <BellOff className="h-5 w-5 text-slate-300" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">Şu an bildirim yok</h2>
        <p className="mt-2 text-sm text-slate-300">
          Yeni bakım, garanti, belge ve ödeme uyarıları geldiğinde bu listede görünecek.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {items.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
