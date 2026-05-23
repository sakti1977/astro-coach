import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astro Coach — Vedic Astrology Personal Coach",
  description: "A personal AI coaching system grounded in Vedic Jyotish astrology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
