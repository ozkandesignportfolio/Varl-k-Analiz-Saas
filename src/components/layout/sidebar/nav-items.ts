import { SIDEBAR_NAV_ITEMS } from "@/constants/sidebar-nav";

export const sidebarNavItems = SIDEBAR_NAV_ITEMS;
export type SidebarMenuItem = (typeof sidebarNavItems)[number];
