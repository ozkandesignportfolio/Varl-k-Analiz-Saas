import type { Metadata, Viewport } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa/register-sw";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AssetCare | Premium Varlık Takip SaaS",
  description:
    "Varlıklarınızın bakım, garanti, servis ve belge süreçlerini premium panelde takip edin.",
  applicationName: "AssetCare",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AssetCare",
  },
};

export const viewport: Viewport = {
  themeColor: "#070b18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${manrope.variable} ${spaceMono.variable} antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
