"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@hooks/useSession";

type Props = {
  children: React.ReactNode;
  requireRole?: Array<"admin" | "operator" | "viewer">;
  redirectTo?: string;
};

export function AuthGuard({ children, requireRole, redirectTo = "/" }: Props) {
  const router = useRouter();
  const { data, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading && !data) {
      router.replace(redirectTo);
    }
  }, [data, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading your workspace...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Login required</h2>
        <p className="mt-2 text-sm text-slate-600">
          You need to sign in to access this area. Contact an administrator if you do not have an
          account.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (requireRole && !requireRole.includes(data.role)) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
        You do not have permission to view this area.
      </div>
    );
  }

  return <>{children}</>;
}
