"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SecuritySection() {
  return (
    <section className="space-y-4">
      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-lg font-semibold text-white">Güvenlik</h3>
        <p className="mt-1 text-sm text-slate-300">Hesabınızın güvenliğini artırmak için şifre yönetimini kullanın.</p>
        <Button asChild className="mt-4 bg-white/10 text-white hover:bg-white/15">
          <Link href="/reset-password">Şifre değiştir</Link>
        </Button>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-white">Oturumlar</h4>
            <p className="mt-1 text-sm text-slate-300">Aktif cihaz ve oturum geçmişi burada listelenecek.</p>
          </div>
          <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-300">
            Yakında
          </Badge>
        </div>
      </article>
    </section>
  );
}

