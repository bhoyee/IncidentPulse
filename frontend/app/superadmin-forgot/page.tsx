"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@lib/api-client";

export default function SuperadminForgotPage() {
  const [email, setEmail] = useState("salisu.adeboye@gmail.com");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.post("/auth/forgot-password", { email });
      setMessage("OTP code sent to your email");
      setStep("reset");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          : (err as Error)?.message;
      setError(message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", { email, code, newPassword });
      setMessage("Password updated. You can sign in now.");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          : (err as Error)?.message;
      setError(message ?? "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/superadmin-login" className="text-sm text-blue-200 hover:text-blue-100">
            ← Back to super admin login
          </Link>
          <Link href="/" className="text-sm text-blue-200 hover:text-blue-100">
            Home
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Super Admin password reset</h1>
          <p className="text-sm text-slate-300 mb-6">OTP code will be emailed to the super admin address.</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {step === "reset" && (
              <>
                <div>
                  <label className="text-xs text-slate-400">OTP code</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">New password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            {message ? <p className="text-sm text-green-400">{message}</p> : null}
            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              onClick={step === "request" ? requestCode : resetPassword}
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold shadow hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Please wait..." : step === "request" ? "Send OTP" : "Reset password"}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Need help? Contact platform support.
        </div>
      </div>
    </div>
  );
}
