"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqBlock() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <Item q="Reminder’dan farkı nedir?" a="Kayıt + kanıt üretir." />
      <Item q="Free plan yeterli mi?" a="Değer gösterir, premium tamamlar." />
      <Item q="Belgeler güvenli mi?" a="Kullanıcıya özel saklanır." />
      <Item q="Premium neden gerekli?" a="Rapor ve kota için." />
    </Accordion>
  );
}

function Item({ q, a }: { q: string; a: string }) {
  return (
    <AccordionItem value={q}>
      <AccordionTrigger>{q}</AccordionTrigger>
      <AccordionContent>{a}</AccordionContent>
    </AccordionItem>
  );
}
