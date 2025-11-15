"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { StatusSnapshot } from "@lib/types";

type StatusResponse = {
  error: boolean;
  data: StatusSnapshot;
  meta: {
    state: StatusSnapshot["overall_state"];
    uptime24h: number;
  };
};

function buildUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return null;
  }
  const url = new URL(path, base);
  return url.toString();
}

async function fetchStatus(): Promise<StatusResponse> {
  const response = await apiClient.get<StatusResponse>("/public/status");
  return response.data;
}

export function useStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = buildUrl("/public/status/stream");
    if (!url) {
      return;
    }

    const eventSource = new EventSource(url);

    const handleStatus = (event: MessageEvent<string>) => {
      if (!event.data) {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as StatusResponse;
        queryClient.setQueryData(["public-status"], payload);
      } catch (error) {
        console.warn("Failed to process status stream event", error);
      }
    };

    const handleError = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    eventSource.addEventListener("status", handleStatus);
    eventSource.addEventListener("error", handleError);

    return () => {
      eventSource.removeEventListener("status", handleStatus);
      eventSource.removeEventListener("error", handleError);
      eventSource.close();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["public-status"],
    queryFn: fetchStatus,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
}
