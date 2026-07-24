import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { HealthStatus } from "@/components/HealthStatus";
import { Copilot } from "@/components/Copilot";
import { getSessionHouseholdId } from "@/lib/auth";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "HomeScout — עוזר חיפוש הדירה שלך",
  description: "מודעות דירות מותאמות אישית, מדורגות ומוכנות לעיון.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authed = getSessionHouseholdId() !== null;
  return (
    <html lang="he" dir="rtl">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {authed && <Header />}
        {authed && <HealthStatus />}
        {children}
        {authed && <Copilot />}
      </body>
    </html>
  );
}
