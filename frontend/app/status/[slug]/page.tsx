"use client";

import { useEffect, useState } from "react";
import { useStatus } from "@hooks/useStatus";
import { StatusBanner } from "@components/StatusBanner";
import { PublicIncidentCard } from "@components/PublicIncidentCard";
import type { MaintenanceEvent, StatusSnapshot } from "@lib/types";
import Link from "next/link";
import { format } from "date-fns";

const serviceTone: Record<StatusSnapshot["overall_state"], string> = {
  operational: "text-emerald-700 bg-emerald-50 border-emerald-100",
  partial_outage: "text-amber-700 bg-amber-50 border-amber-100",
  major_outage: "text-red-700 bg-red-50 border-red-100"
};

export default function StatusSlugPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [orgSlug, setOrgSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    setOrgSlug(slug);
  }, [slug]);

  const { data, isLoading, isError } = useStatus(undefined, orgSlug);
  const snapshot = data?.data;
  const services = snapshot?.services ?? [];
  const uptime = data?.meta.uptime24h ?? snapshot?.last_24h.uptime_percent ?? 100;
  const lastUpdated = data ? format(new Date(), "PPpp") : null;
  const maintenance = snapshot?.scheduled_maintenance ?? { active: [], upcoming: [] };
  const nextMaintenance =
    maintenance.active[0] ?? maintenance.upcoming[0] ?? null;

  const renderMaintenanceCard = (event: MaintenanceEvent) => {
    const start = format(new Date(event.startsAt), "PPpp");
    const end = format(new Date(event.endsAt), "PPpp");
    return (
      <div
        key={event.id}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500">
              {event.appliesToAll
                ? "All services"
                : event.service
                  ? event.service.name
                  : "Selected services"}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 capitalize">
            {event.status.replace("_", " ")}
          </span>
        </div>
        {event.description ? (
          <p className="mt-2 text-xs text-slate-600">{event.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          {start} – {end}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Status</h1>
          <p className="text-sm text-slate-600">
            Workspace: {slug}
          </p>
          <Link href={`/status?orgSlug=${encodeURIComponent(slug)}`} className="text-xs text-blue-600 underline">
            Switch to selector view
          </Link>
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Not found or unavailable.
        </div>
      ) : isLoading || !snapshot ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading latest status...
        </div>
      ) : (
        <>
          <StatusBanner
            state={snapshot.overall_state}
            activeMaintenanceCount={maintenance.active.length}
            nextMaintenance={nextMaintenance}
          />

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Scheduled maintenance</h2>
              <p className="text-xs text-slate-500">
                {maintenance.active.length} active • {maintenance.upcoming.length} upcoming
              </p>
            </div>
            {maintenance.active.length === 0 && maintenance.upcoming.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No maintenance windows are scheduled at this time.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {[...maintenance.active, ...maintenance.upcoming].map(renderMaintenanceCard)}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Service availability</h2>
              <p className="text-xs text-slate-500">
                {services.length} tracked services
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {services.map((service) => {
                const tone = serviceTone[service.state];
                return (
                  <div
                    key={service.id}
                    className={`rounded-lg border p-4 shadow-sm ${tone}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{service.name}</p>
                      <span className="text-xs uppercase tracking-wide">{service.state.replace("_", " ")}</span>
                    </div>
                    {service.description ? (
                      <p className="mt-1 text-xs opacity-80">{service.description}</p>
                    ) : null}
                    {service.maintenance ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
                        Scheduled maintenance until{" "}
                        {format(new Date(service.maintenance.endsAt), "PPpp")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs opacity-80">
                        Active incidents: {service.activeIncidentCount}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

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
