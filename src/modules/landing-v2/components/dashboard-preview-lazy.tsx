"use client";

import dynamic from "next/dynamic";

export const DashboardPreviewLazy = dynamic(
  () => import("@/modules/landing-v2/components/dashboard-preview").then((module) => module.DashboardPreview),
  { ssr: false }
);
