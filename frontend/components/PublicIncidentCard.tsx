"use client";

import type { StatusSnapshot } from "@lib/types";
import { SeverityBadge } from "./SeverityBadge";
import { formatRelative } from "@lib/format";

type Props = {
  incident: StatusSnapshot["active_incidents"][number];
};

export function PublicIncidentCard({ incident }: Props) {
  const serviceName = incident.service?.name ?? "Service";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{incident.title}</h3>
        <SeverityBadge severity={incident.severity} />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Service: <span className="font-medium text-slate-700">{serviceName}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Started {formatRelative(incident.startedAt)} &mdash; Status:{" "}
        <span className="capitalize">{incident.status}</span>
      </div>
    </div>
  );
}
