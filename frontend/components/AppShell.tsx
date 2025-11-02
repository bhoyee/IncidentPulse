"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const hideHeader = pathname === "/";

  const mainClassName = hideHeader ? "min-h-screen" : "mx-auto max-w-6xl px-4 py-8";

  return (
    <>
      {hideHeader ? null : <AppHeader />}
      <main className={mainClassName}>{children}</main>
    </>
  );
}
