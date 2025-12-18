"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "./useSession";

function buildUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return null;
  }
  return new URL(path, base).toString();
}

export function useSupportStream(enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const orgUrl = buildUrl("/support/stream");
    if (!orgUrl) {
      return;
    }

    const orgSource = new EventSource(orgUrl, { withCredentials: true });
    let fallbackInterval: number | null = null;

    const scheduleFallback = () => {
      if (fallbackInterval) {
        return;
      }
      fallbackInterval = window.setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["support"] });
      }, 15000);
    };

    const clearFallback = () => {
      if (fallbackInterval) {
        window.clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const handleSupport = () => {
      queryClient.invalidateQueries({ queryKey: ["support"] });
    };

    const handleOpen = () => {
      clearFallback();
    };

    const handleError = () => {
      scheduleFallback();
      if (orgSource.readyState === EventSource.CLOSED) {
        orgSource.close();
      }
    };

    orgSource.addEventListener("support", handleSupport);
    orgSource.addEventListener("open", handleOpen);
    orgSource.addEventListener("error", handleError);

    let platformSource: EventSource | null = null;

    if (session?.isSuperAdmin) {
      const platformUrl = buildUrl("/support/platform/stream");
      if (platformUrl) {
        platformSource = new EventSource(platformUrl, { withCredentials: true });
        platformSource.addEventListener("support", handleSupport);
        platformSource.addEventListener("open", handleOpen);
        platformSource.addEventListener("error", () => {
          scheduleFallback();
          if (platformSource?.readyState === EventSource.CLOSED) {
            platformSource.close();
          }
        });
      }
    }

    return () => {
      orgSource.removeEventListener("support", handleSupport);
      orgSource.removeEventListener("open", handleOpen);
      orgSource.removeEventListener("error", handleError);
      orgSource.close();
      if (platformSource) {
        platformSource.removeEventListener("support", handleSupport);
        platformSource.removeEventListener("open", handleOpen);
        platformSource.close();
      }
      clearFallback();
    };
  }, [enabled, queryClient, session?.isSuperAdmin]);
}
