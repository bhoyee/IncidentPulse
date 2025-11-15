"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type IncidentStreamEvent =
  | {
      type: "incident.created" | "incident.updated";
      incident: { id: string };
    }
  | {
      type: "incident.deleted";
      incidentId: string;
    };

function buildUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return null;
  }
  const url = new URL(path, base);
  return url.toString();
}

export function useIncidentStream(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const url = buildUrl("/incidents/stream");
    if (!url) {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });

    const handleIncident = (event: MessageEvent<string>) => {
      if (!event.data) {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as IncidentStreamEvent;
        queryClient.invalidateQueries({ queryKey: ["incidents"], exact: false });
        if ("incident" in payload) {
          queryClient.invalidateQueries({ queryKey: ["incident", payload.incident.id] });
        } else if (payload.incidentId) {
          queryClient.removeQueries({ queryKey: ["incident", payload.incidentId] });
        }
      } catch (error) {
        console.warn("Failed to process incident stream event", error);
      }
    };

    const handleError = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    eventSource.addEventListener("incident", handleIncident);
    eventSource.addEventListener("error", handleError);

    return () => {
      eventSource.removeEventListener("incident", handleIncident);
      eventSource.removeEventListener("error", handleError);
      eventSource.close();
    };
  }, [enabled, queryClient]);
}
