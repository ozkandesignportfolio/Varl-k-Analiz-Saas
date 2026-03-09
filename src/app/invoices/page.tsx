import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { PanelSurface } from "@/components/shared/panel-surface";

export default function Page() {
  return (
    <AppShell>
      <PanelSurface>
        <PageHeader title="Faturalar" subtitle="Fatura kayıtlarını bu alandan yönetin." />
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Fatura listesi ve ödeme durumları bu alanda görüntülenir.
        </div>
      </PanelSurface>
    </AppShell>
  );
}
