"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useInvalidateSession } from "@hooks/useSession";

type SignupResponse = {
  error: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
    orgId?: string;
    membershipRole?: string;
  };
};

type FormState = {
  name: string;
  email: string;
  password: string;
  orgName: string;
  orgSlug: string;
};

export function SignupForm() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    orgName: "",
    orgSlug: ""
  });
  const [error, setError] = useState<string | null>(null);

  const signupMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const response = await apiClient.post<SignupResponse>("/auth/signup", payload);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateSession();
      router.push("/dashboard");
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Sign up failed. Please check your details."
      );
    }
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    signupMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Full name
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={10}
            value={form.password}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Organization name
          <input
            type="text"
            name="orgName"
            value={form.orgName}
            onChange={handleChange}
            placeholder="Acme Corp"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Org slug
          <input
            type="text"
            name="orgSlug"
            value={form.orgSlug}
            onChange={handleChange}
            placeholder="acme"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={signupMutation.isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {signupMutation.isPending ? "Creating account..." : "Create account"}
      </button>
      <p className="text-xs text-slate-500">
        We’ll create a new workspace for you. You’ll be the owner and can invite teammates later.
      </p>
    </form>
  );
}
