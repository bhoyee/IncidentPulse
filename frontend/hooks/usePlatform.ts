"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

type Plan = "free" | "pro" | "enterprise";

export type PlatformOrg = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  status?: "active" | "suspended";
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  rateLimitPerMinute?: number;
  _count?: { members?: number; services?: number; incidents?: number };
  billing?: {
    customerId: string | null;
    subscriptionStatus?: string;
    currentPeriodEnd?: string | null;
    priceId?: string | null;
  };
};

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  platformRole?: "none" | "support" | "sales" | "hr" | "operations";
  createdAt?: string;
  lastLogin?: string | null;
  membershipCount?: number;
  memberships?: Array<{ organizationId: string }>;
};

export type PlatformStaff = {
  id: string;
  name: string;
  email: string;
  platformRole: "support" | "sales" | "hr" | "operations";
  isActive: boolean;
  createdAt?: string;
};

export type PlatformInvoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
  createdAt: number;
};

export type PlatformAuditLog = {
  id: string;
  action: string;
  actorEmail?: string | null;
  actorName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  createdAt: string;
  organizationId?: string;
};

export type PlatformMetrics = {
  totals: {
    orgs: number;
    users: number;
    incidentsWindow: number;
    maintenanceWindow: number;
    activeOrgs?: number;
    inactiveOrgs?: number;
    members?: number;
    admins?: number;
  };
  incidentsTrend: Array<{ bucket: string; count: number }>;
  orgs: Array<
    PlatformOrg & {
      counts: { incidents30: number; members: number; services: number };
      lastActivity: string | null;
    }
  >;
  webhook: Record<string, number>;
  traffic: {
    totalRequests: number;
    errorCount: number;
    avgMs: number;
    statusCounts: Record<string, number>;
    topEndpoints: Array<{ route: string; count: number; avgMs: number; errorRate: number }>;
    perOrg?: Record<string, { totalRequests: number; errorCount: number; totalMs: number; statusCounts: Record<string, number> }>;
  };
  visitors?: {
    total: number;
    topPaths: Array<{ path: string; count: number }>;
    topCountries?: Array<{ country: string; count: number }>;
  };
  trafficPersisted?: {
    topEndpoints: Array<{ route: string; count: number; avgMs: number; errorRate: number }>;
    topEndpointsByOrg: Array<{ orgId: string | null; route: string; count: number; avgMs: number; errorRate: number }>;
  };
};


export function usePlatformOrgs(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "orgs"],
    queryFn: async (): Promise<PlatformOrg[]> => {
      const res = await apiClient.get<{ error: boolean; data: PlatformOrg[] }>(
        "/platform/organizations"
      );
      return res.data.data;
    },
    enabled
  });
}

export function usePlatformUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "users"],
    queryFn: async (): Promise<PlatformUser[]> => {
      const res = await apiClient.get<{ error: boolean; data: PlatformUser[] }>("/platform/users");
      return res.data.data;
    },
    enabled
  });
}

export function usePlatformStaff(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "staff"],
    queryFn: async (): Promise<PlatformStaff[]> => {
      const res = await apiClient.get<{ error: boolean; data: PlatformStaff[] }>("/platform/staff");
      return res.data.data;
    },
    enabled
  });
}

export function useCreatePlatformStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; email: string; platformRole: PlatformStaff["platformRole"] }) => {
      const res = await apiClient.post<{ error: boolean; data: PlatformStaff; meta?: { temporaryPassword?: string } }>(
        "/platform/staff",
        payload
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "staff"] });
      qc.invalidateQueries({ queryKey: ["platform", "users"] });
    }
  });
}

export function useUpdatePlatformStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      name?: string;
      platformRole?: PlatformStaff["platformRole"];
      isActive?: boolean;
    }) => {
      const res = await apiClient.patch<{ error: boolean; data: PlatformStaff }>(
        `/platform/staff/${payload.userId}`,
        {
          name: payload.name,
          platformRole: payload.platformRole,
          isActive: payload.isActive
        }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "staff"] });
      qc.invalidateQueries({ queryKey: ["platform", "users"] });
    }
  });
}

export function useDeletePlatformStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.delete<{ error: boolean; data: PlatformStaff }>(
        `/platform/staff/${userId}`
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "staff"] });
      qc.invalidateQueries({ queryKey: ["platform", "users"] });
    }
  });
}

export function useUpdateOrgStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; status: "active" | "suspended" }) => {
      const res = await apiClient.patch<{ error: boolean; data: PlatformOrg }>(
        `/platform/organizations/${payload.orgId}/status`,
        { status: payload.status }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
    }
  });
}

export function useUpdateOrgPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; plan: Plan }) => {
      const res = await apiClient.patch<{ error: boolean; data: PlatformOrg }>(
        `/platform/organizations/${payload.orgId}/plan`,
        { plan: payload.plan }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
    }
  });
}

export function useUpdateOrgRateLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; rateLimitPerMinute: number }) => {
      const res = await apiClient.patch<{ error: boolean; data: PlatformOrg }>(
        `/platform/organizations/${payload.orgId}/rate-limit`,
        { rateLimitPerMinute: payload.rateLimitPerMinute }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
      qc.invalidateQueries({ queryKey: ["platform", "metrics"] });
    }
  });
}

export function useDeleteOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const res = await apiClient.delete<{ error: boolean; data: PlatformOrg }>(
        `/platform/organizations/${orgId}`
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
    }
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: string; isActive: boolean }) => {
      const res = await apiClient.patch<{ error: boolean; data: PlatformUser }>(
        `/platform/users/${payload.userId}/suspend`,
        { isActive: payload.isActive }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "users"] });
    }
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post<{ error: boolean; data: { temporaryPassword: string } }>(
        `/platform/users/${userId}/reset-password`
      );
      return res.data.data;
    }
  });
}

export function usePlatformMetrics(enabled: boolean, windowDays = 30) {
  const windowParam = Math.max(1, Math.min(90, windowDays));
  return useQuery({
    queryKey: ["platform", "metrics", windowParam],
    queryFn: async (): Promise<PlatformMetrics> => {
      const res = await apiClient.get<{ error: boolean; data: PlatformMetrics }>(`/platform/metrics`, {
        params: { window: windowParam }
      });
      return res.data.data;
    },
    enabled,
    refetchInterval: enabled ? 15000 : false
  });
}

export function usePlatformInvoices(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "orgs", orgId, "invoices"],
    queryFn: async (): Promise<PlatformInvoice[]> => {
      const res = await apiClient.get<{ error: boolean; data: PlatformInvoice[] }>(
        `/platform/organizations/${orgId}/invoices`
      );
      return res.data.data;
    },
    enabled: Boolean(orgId && enabled)
  });
}

export function usePlatformPortal() {
  return useMutation({
    mutationFn: async (orgId: string) => {
      const res = await apiClient.post<{ error: boolean; data: { url: string } }>(
        `/platform/organizations/${orgId}/portal`
      );
      return res.data.data;
    }
  });
}

export function usePlatformAuditLogs(enabled: boolean, params?: { page?: number; pageSize?: number; action?: string }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const action = params?.action;
  return useQuery({
    queryKey: ["platform", "audit", page, pageSize, action],
    queryFn: async (): Promise<{ data: PlatformAuditLog[]; meta: { total: number; page: number; pageSize: number; totalPages?: number } }> => {
      const res = await apiClient.get<{
        error: boolean;
        data: PlatformAuditLog[];
        meta: { total: number; page: number; pageSize: number; totalPages?: number };
      }>(`/platform/audit/logs`, {
        params: { page, pageSize, action }
      });
      return { data: res.data.data, meta: res.data.meta };
    },
    enabled
  });
}
