"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useInvalidateSession } from "@hooks/useSession";

type LoginResponse = {
  error: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
  };
};

type FormState = {
  email: string;
  password: string;
};

export function LoginForm({ onModeChange }: { onModeChange?: (mode: "login" | "signup") => void }) {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const response = await apiClient.post<LoginResponse>("/auth/login", payload);
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
          : "Login failed. Check your credentials."
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
    loginMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
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
            autoComplete="current-password"
            required
            value={form.password}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loginMutation.isPending ? "Signing in..." : "Sign in"}
      </button>
      <div className="text-right text-sm">
        <Link
          href="/forgot-password"
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Forgot password?
        </Link>
        <button
          type="button"
          onClick={() => onModeChange?.("signup")}
          className="ml-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Create account
        </button>
      </div>
    </form>
  );
}
