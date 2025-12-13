"use client";

import Link from "next/link";
import { useSession } from "@hooks/useSession";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { apiClient } from "@lib/api-client";
import { useRouter } from "next/navigation";

export default function SuperadminLoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("salisu.adeboye@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/login", { email, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          : (err as Error)?.message;
      setError(message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">IP</div>
            <div>
              <p className="text-xl font-bold">IncidentPulse</p>
              <p className="text-xs text-blue-200">Platform access</p>
            </div>
          </Link>
          <Link
            href="/login"
            className="text-xs text-blue-200 hover:text-blue-100 underline"
          >
            Back to team login
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold mb-2">Super Admin sign in</h1>
            <p className="text-sm text-slate-300 mb-6">
              Use your platform credentials to access tenant management. OTP password reset is available.
            </p>
            {session ? (
              <div className="space-y-3">
                <p className="text-sm">Signed in as {session.email}</p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold shadow hover:bg-blue-500"
                >
                  Open dashboard <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400">Email</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold shadow hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </div>
            )}
            <div className="mt-4 text-xs text-slate-400">
              Forgot password? <Link href="/superadmin-forgot" className="text-blue-300 hover:text-blue-200">Reset with OTP</Link>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-4">
            <p className="text-sm text-slate-200 font-semibold">Platform access details</p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>• Email: salisu.adeboye@gmail.com</li>
              <li>• This account is seeded as Super Admin. Password can be reset via OTP.</li>
              <li>• OTP reset emails are sent to the address above.</li>
              <li>• Super Admins get the Platform tab for tenant/billing/support controls.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
