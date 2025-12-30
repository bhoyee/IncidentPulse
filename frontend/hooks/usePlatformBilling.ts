"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type PlatformBillingOrg = {
  id: string;
  name: string;
  plan: string;
  billingStatus: string;
  subscriptionStatus: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  updatedAt?: string;
};

export type PlatformBillingData = {
  windowDays: number;
  revenue: { amount: number | null; currency: string };
  counts: { active: number; pastDue: number; canceled: number; paused: number; unknown: number };
  stripeConfigured: boolean;
  orgs: PlatformBillingOrg[];
};

export function usePlatformBilling(enabled: boolean, windowDays: number) {
  return useQuery({
    queryKey: ["platform", "billing", windowDays],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get("/platform/billing", { params: { window: windowDays } });
      return res.data.data as PlatformBillingData;
    }
  });
}

export function usePlatformBillingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; action: "cancel" | "pause" | "resume" | "move_plan" | "credit"; priceId?: string; amount?: number }) => {
      const res = await apiClient.post(`/platform/billing/${payload.orgId}/action`, {
        action: payload.action,
        priceId: payload.priceId,
        amount: payload.amount
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "billing"] });
    }
  });
}
