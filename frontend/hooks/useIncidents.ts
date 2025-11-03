"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { Incident, IncidentStatus, IncidentSeverity } from "@lib/types";

type IncidentListResponse = {
  error: boolean;
  data: Incident[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type SingleIncidentResponse = {
  error: boolean;
  data: Incident & {
    createdBy: {
      id: string;
      name: string;
      email: string;
      teamRoles: string[];
    };
    assignedTo: {
      id: string;
      name: string;
      email: string;
      teamRoles: string[];
    } | null;
    updates: Array<{
      id: string;
      incidentId: string;
      message: string;
      createdAt: string;
      author: {
        id: string;
        name: string;
        email: string;
      };
    }>;
  };
};

export type IncidentFilters = {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  search?: string;
  teamRole?: string;
  assignedTo?: string;
};

export function useIncidents(filters?: IncidentFilters) {
  const query = useMemo(() => ["incidents", filters] as const, [filters]);
  return useQuery({
    queryKey: query,
    queryFn: () => fetchIncidents(filters),
    placeholderData: (previousData) => previousData,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
}

async function fetchIncidents(filters?: IncidentFilters) {
  const response = await apiClient.get<IncidentListResponse>("/incidents", {
    params: {
      status: filters?.status,
      severity: filters?.severity,
      search: filters?.search,
      teamRole: filters?.teamRole,
      assignedTo: filters?.assignedTo,
      pageSize: 50
    }
  });

  return response.data;
}

export function useIncidentDetail(id?: string) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: () => fetchIncidentDetail(id!),
    enabled: Boolean(id)
  });
}

async function fetchIncidentDetail(id: string) {
  const response = await apiClient.get<SingleIncidentResponse>(`/incidents/${id}`);
  return response.data;
}

export function useInvalidateIncidents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["incidents"] });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/incidents/${id}`);
      return id;
    },
    onSuccess: async (_data, incidentId) => {
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      await queryClient.removeQueries({ queryKey: ["incident", incidentId] });
    }
  });
}
