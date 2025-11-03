"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSession } from "@hooks/useSession";
import { useLogout } from "@hooks/useLogout";

const links: Array<{ href: Route; label: string; auth: boolean }> = [
  { href: "/dashboard", label: "Dashboard", auth: true },
  { href: "/status", label: "Status", auth: false },
  { href: "/docs", label: "Documentation", auth: false }
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded bg-brand-500 px-2 py-1 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            IncidentPulse
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
            {links
              .filter((link) => (link.auth ? Boolean(user) : true))
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded px-2 py-1 transition hover:text-brand-600",
                    pathname?.startsWith(link.href) ? "bg-brand-50 text-brand-700" : ""
                  )}
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {user ? (
            <>
              <span>
                {user.name} <span className="text-slate-400">({user.role})</span>
              </span>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logout.isPending ? "Signing out..." : "Logout"}
              </button>
            </>
          ) : (
            <Link href="/status" className="underline">
              Public Status
            </Link>
          )}
        </div>
      </div>
      {logout.isError ? (
        <div className="border-t border-red-200 bg-red-50 py-2 text-center text-xs text-red-600">
          Failed to sign out. Please try again.
        </div>
      ) : null}
    </header>
  );
}
