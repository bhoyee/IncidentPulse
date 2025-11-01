"use client";

import clsx from "clsx";
import type { StatusSnapshot } from "@lib/types";

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
  state: StatusSnapshot["overall_state"];
};

export function StatusBanner({ state }: Props) {
  const content = copy[state];
  return (
    <div className={clsx("rounded-lg border px-4 py-5 text-center shadow-sm", content.tone)}>
      <h2 className="text-lg font-semibold">{content.title}</h2>
      <p className="mt-2 text-sm">{content.description}</p>
    </div>
  );
}
