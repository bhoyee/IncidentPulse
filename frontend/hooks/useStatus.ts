"use client";

import { useQuery } from "@tanstack/react-query";
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

async function fetchStatus(): Promise<StatusResponse> {
  const response = await apiClient.get<StatusResponse>("/public/status");
  return response.data;
}

export function useStatus() {
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
