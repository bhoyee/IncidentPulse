"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useInvalidateSession } from "./useSession";

async function logoutRequest() {
  await apiClient.post("/auth/logout");
}

export function useLogout() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();

  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: async () => {
      await invalidateSession();
      router.push("/login");
    }
  });
}

