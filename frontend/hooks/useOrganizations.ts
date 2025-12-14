"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  membershipRole: string;
  plan?: string;
  servicesCount?: number;
  membersCount?: number;
  status?: string;
  createdAt?: string;
};

export type OrgMember = {
  id: string;
  name: string;
  email: string;
  accountRole?: string;
  membershipRole: string;
  isActive: boolean;
  teamRoles: string[];
};

type OrgListResponse = {
  error: boolean;
  data: Organization[];
};

type SwitchOrgResponse = {
  error: boolean;
  data: {
    organization: Organization;
  };
};

async function fetchOrganizations(): Promise<Organization[]> {
  const res = await apiClient.get<OrgListResponse>("/organizations");
  return res.data.data;
}

async function createOrganization(payload: { name: string; slug: string }): Promise<Organization> {
  const res = await apiClient.post<{ error: boolean; data: Organization }>("/organizations", payload);
  return res.data.data;
}

async function updateOrganization(params: {
  id: string;
  name?: string;
  slug?: string;
}): Promise<Organization> {
  const res = await apiClient.patch<{ error: boolean; data: Organization }>(
    `/organizations/${params.id}`,
    { name: params.name, slug: params.slug }
  );
  return res.data.data;
}

async function deleteOrganization(id: string): Promise<void> {
  await apiClient.delete(`/organizations/${id}`);
}

async function switchOrganization(organizationId: string): Promise<Organization> {
  const res = await apiClient.post<SwitchOrgResponse>("/organizations/switch", {
    organizationId
  });
  return res.data.data.organization;
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 1000 * 60 * 5
  });
}

async function fetchOrgMembers(): Promise<OrgMember[]> {
  const res = await apiClient.get<{ error: boolean; data: OrgMember[] }>("/organizations/members");
  return res.data.data;
}

export function useOrgMembers(enabled: boolean) {
  return useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    enabled
  });
}

type SwitchOrgOptions = {
  onSuccess?: (org: Organization) => void | Promise<void>;
  onSettled?: () => void | Promise<void>;
};

export function useSwitchOrganization(options?: SwitchOrgOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => switchOrganization(organizationId),
    onSuccess: async (org) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("lastOrgId", org.id);
      }
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      const keysToInvalidate = [
        "incidents",
        "services",
        "maintenance",
        "metrics",
        "auditLogs",
        "integration-settings",
        "team-users",
        "org-members",
        "billing",
        "api-keys",
        "support-tickets",
        "platform"
      ];
      keysToInvalidate.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      if (options?.onSuccess) {
        await options.onSuccess(org);
      }
    },
    onSettled: async () => {
      if (options?.onSettled) {
        await options.onSettled();
      }
    }
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    }
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    }
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    }
  });
}

export function useUpdateMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; role: string }) =>
      apiClient.patch(`/organizations/members/${params.userId}`, { role: params.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
    }
  });
}

export function useRemoveMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/organizations/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
    }
  });
}

type InviteResponse = {
  error: boolean;
  data: {
    inviteId: string;
    code: string;
    expiresAt: string;
  };
};

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; role: "owner" | "admin" | "editor" | "viewer" }) =>
      apiClient.post<InviteResponse>("/organizations/members/invite", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
    }
  });
}
