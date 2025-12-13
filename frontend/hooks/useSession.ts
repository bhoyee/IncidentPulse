"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  orgId?: string;
  membershipRole?: string;
  teamRoles: string[];
  isActive: boolean;
  isDemo?: boolean;
  isSuperAdmin?: boolean;
};

type SessionResponse = {
  error: boolean;
  user: SessionUser;
};

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const response = await apiClient.get<SessionResponse>("/auth/me");
    return response.data.user;
  } catch {
    return null;
  }
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false
  });
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["session"] });
}
