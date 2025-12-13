"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useSession } from "./useSession";
import type { AuditLog } from "@lib/types";

type AuditLogResponse = {
  error: boolean;
  data: AuditLog[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AuditLogFilters = {
  action?: string;
  search?: string;
  targetType?: string;
  page?: number;
  pageSize?: number;
};

export function useAuditLogs(enabled: boolean, filters: AuditLogFilters) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["audit-logs", session?.orgId, filters],
    queryFn: async () => {
      const response = await apiClient.get<AuditLogResponse>("/audit/logs", {
        params: {
          action: filters.action,
          search: filters.search,
          targetType: filters.targetType,
          page: filters.page,
          pageSize: filters.pageSize
        }
      });
      return response.data;
    },
    enabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: enabled ? 5000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: enabled,
    refetchOnReconnect: enabled
  });
}
