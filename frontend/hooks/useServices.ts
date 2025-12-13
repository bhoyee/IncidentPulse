"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useSession } from "./useSession";

export type ServiceRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  activeIncidentCount: number;
};

type ServiceListResponse = {
  error: boolean;
  data: ServiceRecord[];
};

type ServiceResponse = {
  error: boolean;
  data: ServiceRecord;
};

type CreatePayload = {
  name: string;
  description?: string | null;
};

type UpdatePayload = {
  id: string;
  name?: string;
  description?: string | null;
  slug?: string;
};

export function useServices(enabled: boolean) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["services", session?.orgId],
    queryFn: fetchServices,
    enabled
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      try {
        const response = await apiClient.post<ServiceResponse>("/services", payload);
        return response.data.data;
      } catch (error: unknown) {
        const maybeError = error as { response?: { status?: number; data?: { message?: string } } };
        if (maybeError?.response?.status === 402) {
          throw new Error(maybeError.response.data?.message ?? "Service limit reached for your plan.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePayload) => {
      try {
        const response = await apiClient.patch<ServiceResponse>(`/services/${id}`, payload);
        return response.data.data;
      } catch (error: unknown) {
        const maybeError = error as { response?: { status?: number; data?: { message?: string } } };
        if (maybeError?.response?.status === 402) {
          throw new Error(maybeError.response.data?.message ?? "Service limit reached for your plan.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/services/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    }
  });
}

async function fetchServices(): Promise<ServiceRecord[]> {
  const response = await apiClient.get<ServiceListResponse>("/services");
  return response.data.data;
}
