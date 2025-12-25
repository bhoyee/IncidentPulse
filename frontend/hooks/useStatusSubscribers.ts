import { useEffect, useState, useCallback } from "react";

type Subscriber = {
  id: string;
  email: string;
  serviceIds: unknown;
  verifiedAt: string | null;
  createdAt: string;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Subscriber[] };

export function useStatusSubscribers() {
  const [state, setState] = useState<State>({ status: "idle" });
  const base = process.env.NEXT_PUBLIC_API_BASE || "";

  const fetchSubs = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`${base}/status-subscribers`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const json = await res.json();
      setState({ status: "ready", data: json.data ?? [] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load subscribers";
      setState({ status: "error", message });
    }
  }, [base]);

  useEffect(() => {
    fetchSubs();
    const id = setInterval(fetchSubs, 10000); // poll every 10s for near real-time updates
    return () => clearInterval(id);
  }, [fetchSubs]);

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${base}/status-subscribers/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      fetchSubs();
    },
    [fetchSubs, base]
  );

  return { state, refresh: fetchSubs, remove };
}
