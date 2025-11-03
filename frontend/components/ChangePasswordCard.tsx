"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

type Props = {
  className?: string;
};

type ChangePasswordResponse = {
  error: boolean;
  message: string;
};

export function ChangePasswordCard({ className }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ChangePasswordResponse>(
        "/auth/change-password",
        {
          currentPassword,
          newPassword
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("Failed to update password. Please try again.");
      }
    }
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (newPassword.length < 10) {
      setFormError("New password must be at least 10 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setFormError("New password must be different from the current password.");
      return;
    }

    setFormError(null);
    mutation.mutate();
  };

  return (
    <div
      className={className}
    >
      <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
      <p className="mt-1 text-xs text-slate-500">
        Update your credentials regularly to keep the account secure.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            minLength={8}
            disabled={mutation.isPending}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={10}
            disabled={mutation.isPending}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={10}
            disabled={mutation.isPending}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
        {successMessage ? <p className="text-xs text-emerald-600">{successMessage}</p> : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Updating..." : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
