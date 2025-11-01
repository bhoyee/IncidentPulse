"use client";

import { format } from "date-fns";
import type { Incident } from "@lib/types";

type Props = {
  incidents: Incident[];
  metrics?: {
    avgFirstResponseMinutesToday: number;
    avgResolveMinutesToday: number;
  };
};

type Card = {
  label: string;
  value: string;
  subLabel: string;
};

export function DashboardStats({ incidents, metrics }: Props) {
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const highOrCritical = openIncidents.filter((incident) =>
    ["high", "critical"].includes(incident.severity)
  );

  const cards: Card[] = [
    {
      label: "Open incidents",
      value: openIncidents.length.toString(),
      subLabel: `${incidents.length} total`
    },
    {
      label: "High & critical",
      value: highOrCritical.length.toString(),
      subLabel: `${format(new Date(), "MMM d")}`
    },
    {
      label: "Avg first response (today)",
      value: metrics ? `${metrics.avgFirstResponseMinutesToday} min` : "n/a",
      subLabel: "target < 15 min"
    },
    {
      label: "Avg resolve (today)",
      value: metrics ? `${metrics.avgResolveMinutesToday} min` : "n/a",
      subLabel: "target < 120 min"
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{card.subLabel}</p>
        </div>
      ))}
    </div>
  );
}
