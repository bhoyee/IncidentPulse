"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  teamRoles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string | null;
};

export type TeamUsersResponse = {
  error: boolean;
  data: TeamUser[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type UpdateUserResponse = {
  error: boolean;
  data: TeamUser;
};

type CreateUserResponse = {
  error: boolean;
  data: TeamUser;
  meta: {
    initialPassword: string | null;
  };
};

export type UpdateUserPayload = {
  role?: "admin" | "operator" | "viewer";
  isActive?: boolean;
  teamRoles?: string[];
  name?: string;
  email?: string;
};

type CreateUserPayload = {
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  teamRoles?: string[];
  isActive?: boolean;
  password?: string;
};

export type TeamUsersFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export function useTeamUsers(enabled: boolean, filters: TeamUsersFilters) {
  return useQuery({
    queryKey: ["team-users", filters],
    queryFn: async () => {
      const response = await apiClient.get<TeamUsersResponse>("/team/users", {
        params: {
          search: filters.search || undefined,
          page: filters.page,
          pageSize: filters.pageSize
        }
      });
      return response.data;
    },
    enabled,
    placeholderData: (previousData) => previousData
  });
}

export function useCreateTeamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const response = await apiClient.post<CreateUserResponse>("/team/users", payload);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-users"] });
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    }
  });
}

export function useUpdateTeamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
      const response = await apiClient.patch<UpdateUserResponse>(`/team/users/${id}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-users"] });
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    }
  });
}

export function useDeleteTeamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/team/users/${id}`);
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-users"] });
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    }
  });
}
