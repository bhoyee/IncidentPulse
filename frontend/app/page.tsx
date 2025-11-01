"use client";

import Link from "next/link";
import { useStatus } from "@hooks/useStatus";
import { StatusBanner } from "@components/StatusBanner";
import { PublicIncidentCard } from "@components/PublicIncidentCard";

export default function HomePage() {
  const { data, isLoading } = useStatus();

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Stay informed with IncidentPulse</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Track incidents, keep your team aligned, and share transparent updates with your customers.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 font-semibold text-white shadow hover:bg-brand-700"
          >
            Go to dashboard
          </Link>
          <Link href="/status" className="inline-flex items-center text-brand-600 hover:underline">
            View public status page
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Current system state</h2>
        {isLoading || !data ? (
          <div className="h-24 rounded-lg border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
            <div className="flex h-full items-center justify-center">Loading status...</div>
          </div>
        ) : (
          <>
            <StatusBanner state={data.meta.state} />
            <div className="grid gap-3 sm:grid-cols-2">
              {data.data.active_incidents.length === 0 ? (
                <div className="col-span-full rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  No active incidents. All systems are healthy.
                </div>
              ) : (
                data.data.active_incidents.map((incident) => (
                  <PublicIncidentCard key={incident.id} incident={incident} />
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
