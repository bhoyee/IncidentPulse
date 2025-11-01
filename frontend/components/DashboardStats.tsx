"use client";

import { format } from "date-fns";
import {
  BoltIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";
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
  icon: typeof BoltIcon;
  accent: string;
  glow: string;
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
      subLabel: `${incidents.length} total in rotation`,
      icon: BoltIcon,
      accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-200",
      glow: "from-emerald-400/20 via-emerald-500/15 to-transparent"
    },
    {
      label: "High & critical",
      value: highOrCritical.length.toString(),
      subLabel: `snapshot · ${format(new Date(), "MMM d")}`,
      icon: ExclamationTriangleIcon,
      accent: "border-rose-400/60 bg-rose-500/10 text-rose-200",
      glow: "from-rose-400/20 via-rose-500/15 to-transparent"
    },
    {
      label: "Avg first response",
      value: metrics ? `${metrics.avgFirstResponseMinutesToday} min` : "n/a",
      subLabel: "target under 15 minutes",
      icon: ClockIcon,
      accent: "border-sky-400/60 bg-sky-500/10 text-sky-200",
      glow: "from-sky-400/20 via-sky-500/15 to-transparent"
    },
    {
      label: "Avg resolve time",
      value: metrics ? `${metrics.avgResolveMinutesToday} min` : "n/a",
      subLabel: "target under 120 minutes",
      icon: ChartBarIcon,
      accent: "border-indigo-400/60 bg-indigo-500/10 text-indigo-200",
      glow: "from-indigo-400/20 via-indigo-500/15 to-transparent"
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 px-6 py-6 text-slate-100 shadow-xl backdrop-blur"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-slate-300">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
                <p className="mt-2 text-xs text-slate-400">{card.subLabel}</p>
              </div>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${card.accent}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div
              className={`pointer-events-none absolute inset-px rounded-[calc(theme(borderRadius.3xl)-1px)] bg-gradient-to-br opacity-0 transition duration-300 group-hover:opacity-100 ${card.glow}`}
            />
          </div>
        );
      })}
    </div>
  );
}
