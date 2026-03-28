import type { ComponentType } from "react";
import { DashboardView } from "@/modules/landing-v2/components/panel-preview/views/DashboardView";
import { ListView } from "@/modules/landing-v2/components/panel-preview/views/ListView";
import type { PanelPreviewViewProps, PreviewMenuKey } from "@/modules/landing-v2/components/panel-preview/types";

export const panelPreviewViews: Record<PreviewMenuKey, ComponentType<PanelPreviewViewProps>> = {
  dashboard: DashboardView,
  assets: ListView,
  maintenance: ListView,
  services: ListView,
  documents: ListView,
  timeline: ListView,
  expenses: ListView,
  notifications: ListView,
  billing: ListView,
  invoices: ListView,
  costs: ListView,
  reports: ListView,
  settings: ListView,
};
