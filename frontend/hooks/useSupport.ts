"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type SupportTicket = {
  id: string;
  subject: string;
  body: string;
  status: "open" | "pending" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category?: string | null;
  organizationId: string;
  organization?: { id: string; name: string; slug?: string; plan?: string } | null;
  assignee?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  comments?: Array<{
    id: string;
    body: string;
    isInternal?: boolean;
    createdAt: string;
    author?: { id: string; name: string; email: string } | null;
  }>;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    path: string;
    createdAt: string;
  }>;
};

type TicketResponse = { error: boolean; data: SupportTicket[]; meta?: { page: number; pageSize: number; total: number } };
type TicketCreatePayload = { subject: string; body: string; priority?: string; category?: string };
type SupportAttachment = NonNullable<SupportTicket["attachments"]>[number];

export function useOrgSupportTickets(filters?: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["support", "org", filters?.status ?? "", filters?.q ?? "", filters?.page ?? 1, filters?.pageSize ?? 10],
    queryFn: async () => {
      const res = await apiClient.get<TicketResponse>("/support", {
        params: {
          status: filters?.status || undefined,
          q: filters?.q || undefined,
          page: filters?.page || undefined,
          pageSize: filters?.pageSize || undefined
        }
      });
      return res.data;
    },
    enabled: filters?.enabled ?? true
  });
}

export function usePlatformSupportTickets(
  enabled: boolean,
  filters?: { status?: string; orgId?: string; page?: number; pageSize?: number }
) {
  return useQuery({
    queryKey: [
      "support",
      "platform",
      filters?.status ?? "",
      filters?.orgId ?? "",
      filters?.page ?? 1,
      filters?.pageSize ?? 20
    ],
    queryFn: async () => {
      const res = await apiClient.get<TicketResponse>("/support/platform", {
        params: {
          status: filters?.status || undefined,
          orgId: filters?.orgId || undefined,
          page: filters?.page || undefined,
          pageSize: filters?.pageSize || undefined
        }
      });
      return res.data;
    },
    enabled
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TicketCreatePayload) => {
      const res = await apiClient.post<{ error: boolean; data: SupportTicket }>("/support", payload);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useAddSupportComment(scope: "org" | "platform" = "org") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; body: string; isInternal?: boolean }) => {
      const base = scope === "platform" ? "/support/platform" : "/support";
      const res = await apiClient.post<{ error: boolean; data: { id: string } }>(
        `${base}/${payload.ticketId}/comments`,
        { body: payload.body, isInternal: payload.isInternal }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useUpdateSupportStatus(scope: "org" | "platform" = "org") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; status: "open" | "pending" | "closed" }) => {
      const endpoint =
        scope === "platform"
          ? `/support/platform/${payload.ticketId}/status`
          : `/support/${payload.ticketId}/status`;
      const res = await apiClient.patch<{ error: boolean; message?: string; data?: SupportTicket }>(
        endpoint,
        { status: payload.status }
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useReactivateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await apiClient.post<{ error: boolean; message?: string }>(
        `/support/${ticketId}/reactivate`
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useAssignSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; assigneeId?: string | null }) => {
      const res = await apiClient.patch<{ error: boolean; data: SupportTicket }>(
        `/support/platform/${payload.ticketId}/assign`,
        { assigneeId: payload.assigneeId ?? null }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useDeleteSupportComment(scope: "org" | "platform" = "platform") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; commentId: string }) => {
      const base = scope === "platform" ? "/support/platform" : "/support";
      const res = await apiClient.delete<{ error: boolean; message?: string }>(
        `${base}/${payload.ticketId}/comments/${payload.commentId}`
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useUpdateSupportTicket(scope: "org" | "platform" = "platform") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ticketId: string;
      subject?: string;
      body?: string;
      priority?: "low" | "medium" | "high" | "urgent";
      category?: string | null;
    }) => {
      const base = scope === "platform" ? "/support/platform" : "/support";
      const res = await apiClient.patch<{ error: boolean; data: SupportTicket }>(
        `${base}/${payload.ticketId}`,
        {
          subject: payload.subject,
          body: payload.body,
          priority: payload.priority,
          category: payload.category
        }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useDeleteSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await apiClient.delete<{ error: boolean; message?: string }>(
        `/support/platform/${ticketId}`
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}

export function useUploadSupportAttachments(scope: "org" | "platform" = "org") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; files: File[] }) => {
      const form = new FormData();
      payload.files.forEach((file) => form.append("file", file));
      const base = scope === "platform" ? "/support/platform" : "/support";
      const res = await apiClient.post<{ error: boolean; data: SupportAttachment[] }>(
        `${base}/${payload.ticketId}/attachments`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
    }
  });
}
