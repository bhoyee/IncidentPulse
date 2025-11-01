import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@components/AppHeader";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IncidentPulse",
  description: "Incident tracking and public status pages for small teams."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
