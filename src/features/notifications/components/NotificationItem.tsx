"use client";

import {
  BellRing,
  CheckCheck,
  FileBadge,
  LifeBuoy,
  ShieldAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NotificationRecord, NotificationType } from "@/features/notifications/data/mock-notifications";

type NotificationItemProps = {
  notification: NotificationRecord;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
};

const iconByType: Record<NotificationType, ComponentType<{ className?: string }>> = {
  "Bakım": Wrench,
  "Garanti": ShieldAlert,
  "Belge": FileBadge,
  "Ödeme": BellRing,
  "Sistem": LifeBuoy,
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const Icon = iconByType[notification.type];
  const isRead = notification.status === "Okundu";

  return (
    <article className="premium-card border-white/10 bg-white/[0.02] p-4 shadow-[0_12px_30px_rgba(2,8,23,0.28)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
            <Icon className="h-4 w-4 text-slate-200" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{notification.title}</h3>
              <Badge
                variant="outline"
                className={
                  isRead
                    ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                    : "border-amber-300/35 bg-amber-300/10 text-amber-100"
                }
              >
                {notification.status}
              </Badge>
              <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-200">
                {notification.type}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-300">{notification.description}</p>
            <p className="mt-2 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onMarkRead(notification.id)}
            disabled={isRead}
            className="border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <CheckCheck className="h-4 w-4" />
            Okundu
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDelete(notification.id)}
            className="text-rose-200 hover:bg-rose-500/15 hover:text-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </Button>
        </div>
      </div>
    </article>
  );
}
