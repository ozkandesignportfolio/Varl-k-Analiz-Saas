import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assetly | Landing v2",
  description: "Assetly v2 landing page",
};

export default function LandingV2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}