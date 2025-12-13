"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type ApiKey = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type ListResponse = {
  error: boolean;
  data: ApiKey[];
};

type CreateResponse = {
  error: boolean;
  data: ApiKey;
  meta: { key: string };
};

export function useApiKeys(enabled: boolean) {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await apiClient.get<ListResponse>("/api-keys");
      return res.data.data;
    },
    enabled
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.post<CreateResponse>("/api-keys", { name });
      return res.data.meta.key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    }
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    }
  });
}
