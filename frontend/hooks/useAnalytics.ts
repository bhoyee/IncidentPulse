"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useSession } from "./useSession";

export type AnalyticsResponse = {
  error: boolean;
  data: {
    avgResolutionMinutes: number;
    avgFirstResponseMinutes: number;
    severityBreakdown: Array<{ severity: string; count: number }>;
    serviceBreakdown: Array<{ serviceId: string | null; serviceName: string; count: number }>;
    weeklyTrend: Array<{ bucket: string; count: number }>;
    monthlyTrend: Array<{ bucket: string; count: number }>;
  };
};

export function useAnalytics() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["analytics", session?.orgId],
    queryFn: async () => {
      const response = await apiClient.get<AnalyticsResponse>("/metrics/analytics");
      return response.data.data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
