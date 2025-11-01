"use client";

import clsx from "clsx";
import type { IncidentSeverity } from "@lib/types";

const severityStyles: Record<IncidentSeverity, string> = {
  low: "bg-severity-low/10 text-severity-low",
  medium: "bg-severity-medium/10 text-severity-medium",
  high: "bg-severity-high/10 text-severity-high",
  critical: "bg-severity-critical/10 text-severity-critical"
};

type Props = {
  severity: IncidentSeverity;
};

export function SeverityBadge({ severity }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        severityStyles[severity]
      )}
    >
      {severity}
    </span>
  );
}
