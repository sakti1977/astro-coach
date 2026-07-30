import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from '@vercel/analytics/next';
import AuthProvider from "@/components/AuthProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astro Coach — Vedic Astrology Personal Coach",
  description: "A personal AI coaching system grounded in Vedic Jyotish astrology",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
          <Analytics />
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
