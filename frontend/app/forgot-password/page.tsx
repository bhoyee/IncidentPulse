"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

type ApiResponse = {
  error: boolean;
  message?: string;
};

type Stage = "request" | "verify" | "success";

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse>("/auth/forgot-password", { email });
      return response.data;
    },
    onSuccess: (data) => {
      setStage("verify");
      setInfoMessage(data.message ?? "We emailed you a verification code.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to send reset code. Please try again."
      );
    }
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse>("/auth/reset-password", {
        email,
        code,
        newPassword
      });
      return response.data;
    },
    onSuccess: (data) => {
      setStage("success");
      setInfoMessage(data.message ?? "Password updated successfully.");
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to reset password. Please verify the code and try again."
      );
    }
  });

  const handleSendCode: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    requestMutation.mutate();
  };

  const handleResetPassword: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    resetMutation.mutate();
  };

  const resendCode = () => {
    setError(null);
    setInfoMessage(null);
    requestMutation.mutate();
  };

  const isRequesting = requestMutation.isPending;
  const isResetting = resetMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen">
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:max-w-md">
            <div className="text-center mb-8">
              <Link href="/" className="inline-flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700">
                  <span className="text-xl font-bold text-white">IP</span>
                </div>
                <div className="text-left">
                  <span className="text-2xl font-bold text-gray-900">IncidentPulse</span>
                  <span className="block text-xs text-blue-600 font-medium">ENTERPRISE</span>
                </div>
              </Link>
              <h1 className="mt-8 text-3xl font-bold tracking-tight text-gray-900">
                Reset your password
              </h1>
              <p className="mt-3 text-gray-600">
                Enter your account email and we&apos;ll send you a 6-digit verification code.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-4">
              {stage === "request" ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value.trim())}
                      required
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  {infoMessage ? <p className="text-sm text-emerald-600">{infoMessage}</p> : null}
                  <button
                    type="submit"
                    disabled={isRequesting}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isRequesting ? "Sending code..." : "Send verification code"}
                  </button>
                </form>
              ) : null}

              {stage === "verify" ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                    Enter the 6-digit code sent to <strong>{email}</strong>. Demo accounts cannot
                    reset passwords via email.
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    Verification code
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                      required
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm tracking-[0.6em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    New password
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      minLength={10}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    Confirm new password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={10}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  {infoMessage ? <p className="text-sm text-emerald-600">{infoMessage}</p> : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={resendCode}
                      disabled={isRequesting}
                      className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-60"
                    >
                      {isRequesting ? "Sending…" : "Resend code"}
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setStage("request");
                          setCode("");
                          setNewPassword("");
                          setConfirmPassword("");
                          setInfoMessage(null);
                        }}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Start over
                      </button>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isResetting ? "Updating..." : "Reset password"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}

              {stage === "success" ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-full bg-emerald-50 mx-auto h-12 w-12 flex items-center justify-center">
                    <span className="text-emerald-600 text-xl">✓</span>
                  </div>
                  <p className="text-gray-700">
                    {infoMessage ?? "Your password has been updated. You can sign in with the new credentials now."}
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Return to sign in
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              Remembered your password?{" "}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>

        <div className="relative hidden w-0 flex-1 bg-slate-900 lg:block">
          <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-300">Security first</p>
              <h2 className="mt-3 text-3xl font-bold">Hardened for on-call teams</h2>
              <p className="mt-4 text-slate-200 text-sm leading-relaxed">
                Enforce strong passwords, audit every login, and lock demo environments to read-only so you can safely showcase IncidentPulse.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm text-slate-300">Need help?</p>
              <p className="mt-2 text-lg font-semibold">binsalith@gmail.com</p>
              <p className="mt-1 text-sm text-slate-400">We respond within one business day.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
