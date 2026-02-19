"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function PremiumGate({ feature }: { feature: string }) {
  return (
    <Card className="mx-auto w-full max-w-xl border-primary/40 bg-primary/5 text-center">
      <CardHeader className="items-center">
        <Badge variant="outline" className="border-primary/40 text-primary">
          Premium
        </Badge>
        <CardTitle className="text-lg">Bu özellik Premium</CardTitle>
        <CardDescription>{feature} sadece Premium planda aktif.</CardDescription>
      </CardHeader>

      <CardFooter className="justify-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Premium&apos;a Geç</Button>
          </DialogTrigger>

          <DialogContent className="border-border/60 bg-background">
            <DialogHeader>
              <DialogTitle>Premium ile devam et</DialogTitle>
              <DialogDescription>{feature} özelliğini kullanmak için Premium plan gerekli.</DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Panele Dön</Link>
              </Button>
              <Button asChild>
                <Link href="/subscriptions">Abonelik Sayfası</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
