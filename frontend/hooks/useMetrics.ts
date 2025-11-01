"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { MetricsResponse } from "@lib/types";

type MetricsApiResponse = {
  error: boolean;
  data: MetricsResponse;
};

async function fetchMetrics(): Promise<MetricsResponse> {
  const response = await apiClient.get<MetricsApiResponse>("/metrics/sla");
  return response.data.data;
}

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics", "sla"],
    queryFn: fetchMetrics,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
}
