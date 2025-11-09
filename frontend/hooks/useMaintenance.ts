"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { MaintenanceEvent } from "@lib/types";

type MaintenanceListResponse = {
  error: boolean;
  data: MaintenanceEvent[];
};

type MaintenanceMutationResponse = {
  error: boolean;
  data: MaintenanceEvent;
};

export type MaintenancePayload = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  appliesToAll: boolean;
  serviceId?: string | null;
};

export function useMaintenanceEvents(
  window: "upcoming" | "past" | "all" = "upcoming",
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["maintenance-events", window],
    queryFn: async () => {
      const response = await apiClient.get<MaintenanceListResponse>("/maintenance", {
        params: { window }
      });
      return response.data.data;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false
  });
}

export function useCreateMaintenanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MaintenancePayload) => {
      const response = await apiClient.post<MaintenanceMutationResponse>("/maintenance", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["maintenance-events"] });
    }
  });
}

export function useUpdateMaintenanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<MaintenancePayload> }) => {
      const response = await apiClient.patch<MaintenanceMutationResponse>(`/maintenance/${id}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["maintenance-events"] });
    }
  });
}

export function useCancelMaintenanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<MaintenanceMutationResponse>(`/maintenance/${id}/cancel`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["maintenance-events"] });
    }
  });
}
