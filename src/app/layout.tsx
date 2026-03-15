import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa/register-sw";
import { PlanProvider } from "@/contexts/PlanContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assetly | Premium Varlık Takip SaaS",
  description:
    "Varlıklarınızın bakım, garanti, servis ve belge süreçlerini premium panelde takip edin.",
  applicationName: "Assetly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    shortcut: ["/favicon.ico?v=2"],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Assetly",
  },
};

export const viewport: Viewport = {
  themeColor: "#080D1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={jetBrainsMono.variable} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={inter.className}>
        <PlanProvider>
          <PwaRegister />
          {children}
        </PlanProvider>
      </body>
    </html>
  );
}
