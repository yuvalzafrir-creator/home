import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { HealthStatus } from "@/components/HealthStatus";
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
  title: "HomeScout — your home search assistant",
  description: "Personalized apartment listings, scored and ready to review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Header />
        <HealthStatus />
        {children}
      </body>
    </html>
  );
}
