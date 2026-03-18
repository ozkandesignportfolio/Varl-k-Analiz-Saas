import type { CSSProperties } from "react";
import type { SidebarNavKey } from "@/constants/sidebar-nav";

export type PreviewMenuKey = SidebarNavKey;
export type PreviewListMenuKey = Exclude<PreviewMenuKey, "dashboard">;

export type PreviewMenuItem = {
  key: PreviewMenuKey;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
};

export type RowItem = {
  title: string;
  detail: string;
  badge: string;
  date: string;
  amount: string;
};

export type PanelPreviewViewProps = {
  rows: RowItem[];
  menuItem: PreviewMenuItem;
};

export type PreviewTheme = CSSProperties;
