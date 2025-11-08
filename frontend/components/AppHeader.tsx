"use client";

import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded bg-blue-600 px-2 py-1 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            IncidentPulse
          </Link>
          <span className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Operations
          </span>
        </div>
        <nav className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <Link href="/status" className="hover:text-slate-200">
            Status
          </Link>
          <Link href="/docs" className="hover:text-slate-200">
            Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}
