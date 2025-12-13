"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@lib/api-client";
import { useToast } from "@components/Toast";

type AcceptResponse = {
  error: boolean;
  message: string;
  data?: {
    orgId: string;
    email: string;
    membershipRole: string;
  };
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [form, setForm] = useState({ code: "", name: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<AcceptResponse>("/organizations/members/accept", form);
      if (res.data.error) {
        setError(res.data.message);
        addToast(res.data.message, "error");
      } else {
        addToast("Invite accepted", "success");
        router.push("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invite.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Accept Invitation</h1>
        <p className="text-sm text-slate-400 mb-4">
          Enter the invite code you received to join the organization.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs text-slate-300 block">
            Invite code
            <input
              required
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Paste your invite code"
            />
          </label>
          <label className="text-xs text-slate-300 block">
            Full name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Your name"
            />
          </label>
          <label className="text-xs text-slate-300 block">
            Password
            <input
              required
              type="password"
              minLength={10}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Create a password"
            />
          </label>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? "Joining..." : "Join workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
