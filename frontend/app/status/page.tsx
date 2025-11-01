"use client";

import { format } from "date-fns";
import { useStatus } from "@hooks/useStatus";
import { StatusBanner } from "@components/StatusBanner";
import { PublicIncidentCard } from "@components/PublicIncidentCard";

export default function StatusPage() {
  const { data, isLoading } = useStatus();

  const snapshot = data?.data;
  const uptime = data?.meta.uptime24h ?? snapshot?.last_24h.uptime_percent ?? 100;
  const lastUpdated = data ? format(new Date(), "PPpp") : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold	text-slate-900">Status</h1>
        <p className="mt-1 text-sm text-slate-600">
          We keep this page updated in real-time to share the current health of our services.
        </p>
      </div>

      {isLoading || !snapshot ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading latest status...
        </div>
      ) : (
        <>
          <StatusBanner state={snapshot.overall_state} />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Uptime (24h)</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{uptime.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Incidents (24h)</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {snapshot.last_24h.incident_count}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Last updated</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{lastUpdated}</p>
            </div>
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Active incidents</h2>
            {snapshot.active_incidents.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                All systems operational. No active incidents.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {snapshot.active_incidents.map((incident) => (
                  <PublicIncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
