"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  teamRoles: string[];
  isActive: boolean;
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
    staleTime: 1000 * 60 * 5
  });
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["session"] });
}
