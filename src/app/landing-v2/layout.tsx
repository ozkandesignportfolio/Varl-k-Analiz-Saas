import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AssetCare | Landing v2",
  description: "AssetCare v2 landing page",
};

export default function LandingV2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}