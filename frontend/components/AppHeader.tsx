"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@hooks/useSession";
import { useOrganizations, useSwitchOrganization } from "@hooks/useOrganizations";

export function AppHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: orgs } = useOrganizations();
  const switchOrg = useSwitchOrganization({
    onSuccess: async () => {
      router.refresh();
    }
  });
  const [selectedOrg, setSelectedOrg] = useState<string | undefined>(session?.orgId);

  useEffect(() => {
    setSelectedOrg(session?.orgId);
  }, [session?.orgId]);

  const currentOrg = orgs?.find((o) => o.id === session?.orgId);
  const statusLink =
    session?.orgId && currentOrg?.slug
      ? { pathname: `/status/${currentOrg.slug}` }
      : session?.orgId
        ? { pathname: "/status", query: { orgId: session.orgId } }
        : { pathname: "/status" };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrg(orgId);
    if (orgId && orgId !== session?.orgId) {
      await switchOrg.mutateAsync(orgId);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded bg-blue-600 px-2 py-1 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            IncidentPulse
          </Link>
          <span className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Operations
          </span>
        </div>
        <nav className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <Link href={statusLink} className="hover:text-slate-200">
            Status
          </Link>
          <Link href="/docs" className="hover:text-slate-200">
            Docs
          </Link>
          {session && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Org</span>
              <select
                value={selectedOrg ?? ""}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
              >
                {(orgs ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
