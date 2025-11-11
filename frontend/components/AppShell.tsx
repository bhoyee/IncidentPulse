"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import type { PropsWithChildren } from "react";
import { DemoModeBanner } from "./DemoModeBanner";
import { useSession } from "@hooks/useSession";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isDocs = pathname?.startsWith("/docs");
  const hideHeader = pathname === "/";
  const { data: session } = useSession();
  const showDemoBanner = Boolean(session?.isDemo) && !hideHeader;

  const mainClassName = isDashboard
    ? "mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-6 lg:px-12"
    : hideHeader
      ? "min-h-screen"
      : isDocs
        ? "w-full px-0 py-8"
        : "mx-auto max-w-6xl px-4 py-8";

  return (
    <>
      {hideHeader ? null : <AppHeader />}
      {showDemoBanner ? <DemoModeBanner /> : null}
      <main className={mainClassName}>{children}</main>
      {hideHeader ? null : <AppFooter />}
    </>
  );
}
