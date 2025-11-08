"use client";

import Link from "next/link";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          IncidentPulse &middot; Operational Intelligence
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link className="hover:text-slate-200" href="/docs">
            Documentation
          </Link>
          <Link className="hover:text-slate-200" href="/status">
            Public Status
          </Link>
          <span className="text-slate-500">&copy; {year} IncidentPulse</span>
        </div>
      </div>
    </footer>
  );
}
