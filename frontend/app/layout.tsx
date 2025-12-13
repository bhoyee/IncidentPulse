import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@components/AppShell";
import { Providers } from "./providers";
import { ToastProvider } from "@components/Toast";

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
      <body className="min-h-screen bg-[#0f1729] text-slate-100">
        <ToastProvider>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}
