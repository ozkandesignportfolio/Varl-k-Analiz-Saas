"use client";

import dynamic from "next/dynamic";

export const DashboardPreviewLazy = dynamic(
  () => import("./dashboard-preview").then((module) => module.DashboardPreview),
  { ssr: false }
);
