import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PanelSurface } from "@/components/panel-surface";

export default function Page() {
  return (
    <AppShell>
      <PanelSurface>
        <PageHeader title="Faturalar" subtitle="Fatura kayitlarini bu alandan yonetin." />
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Fatura icerigi henuz eklenmedi.
        </div>
      </PanelSurface>
    </AppShell>
  );
}
