"use client";

import clsx from "clsx";
import type { MaintenanceEvent, StatusSnapshot } from "@lib/types";

const copy: Record<StatusSnapshot["overall_state"], { title: string; description: string; tone: string }> =
  {
    operational: {
      title: "All systems operational",
      description: "Everything is running smoothly.",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200"
    },
    partial_outage: {
      title: "Partial outage",
      description: "Some services are impacted. Our engineers are on it.",
      tone: "bg-amber-50 text-amber-700 border-amber-200"
    },
    major_outage: {
      title: "Major outage",
      description: "Critical services are down. Please stand by for updates.",
      tone: "bg-red-50 text-red-700 border-red-200"
    }
  };

type Props = {
  state?: StatusSnapshot["overall_state"];
  activeMaintenanceCount?: number;
  nextMaintenance?: MaintenanceEvent | null;
};

export function StatusBanner({ state, activeMaintenanceCount = 0, nextMaintenance }: Props) {
  const hasActiveMaintenance = activeMaintenanceCount > 0;
  const content = copy[state ?? "operational"];

  if (hasActiveMaintenance) {
    return (
      <div className="rounded-lg border border-slate-200 bg-blue-50 px-4 py-5 text-center text-blue-900 shadow-sm">
        <h2 className="text-lg font-semibold">Scheduled maintenance in progress</h2>
        <p className="mt-2 text-sm">
          {activeMaintenanceCount === 1
            ? "One planned maintenance window is currently active."
            : `${activeMaintenanceCount} maintenance windows are currently active.`}
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("rounded-lg border px-4 py-5 text-center shadow-sm", content.tone)}>
      <h2 className="text-lg font-semibold">{content.title}</h2>
      <p className="mt-2 text-sm">{content.description}</p>
      {nextMaintenance ? (
        <p className="mt-3 text-xs opacity-80">
          Next scheduled maintenance begins {new Date(nextMaintenance.startsAt).toLocaleString()}.
        </p>
      ) : null}
    </div>
  );
}
