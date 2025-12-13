"use client";

import { useEffect, useMemo } from "react";
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

function buildUrl(path: string, orgId?: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return null;
  }
  const url = new URL(path, base);
  if (orgId) {
    url.searchParams.set("orgId", orgId);
  }
  return url.toString();
}

async function fetchStatus(params: { orgId?: string; orgSlug?: string }): Promise<StatusResponse> {
  const response = await apiClient.get<StatusResponse>("/public/status", {
    params
  });
  return response.data;
}

export function useStatus(orgId?: string, orgSlug?: string) {
  const queryClient = useQueryClient();
  const cacheKey = useMemo(() => ["public-status", orgId ?? orgSlug], [orgId, orgSlug]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = buildUrl("/public/status/stream", orgId ?? orgSlug);
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
        queryClient.setQueryData(cacheKey, payload);
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
  }, [cacheKey, orgId, orgSlug, queryClient]);

  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchStatus({ orgId, orgSlug }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
}
