"use client";

import Link from "next/link";
import { LoginForm } from "@components/LoginForm";
import { useSession } from "@hooks/useSession";

export default function LoginPage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Sign in to IncidentPulse</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your work email to access the incident dashboard and respond to outages.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {session ? (
          <div className="text-sm text-emerald-600">
            You are already logged in as <strong>{session.email}</strong>.{" "}
            <Link href="/dashboard" className="text-brand-600 hover:underline">
              Go to dashboard
            </Link>
            .
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
      <div className="text-center text-xs text-slate-500">
        Need access? Contact your IncidentPulse administrator.
      </div>
    </div>
  );
}
