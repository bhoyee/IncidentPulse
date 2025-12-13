"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@hooks/useSession";
import { useOrganizations, useSwitchOrganization } from "@hooks/useOrganizations";
import { useToast } from "@components/Toast";

export function OrgSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: orgs } = useOrganizations();
  const switchOrg = useSwitchOrganization({
    onSuccess: async () => {
      router.refresh();
    }
  });

  const currentOrgId = session?.orgId;

  const sortedOrgs = useMemo(() => {
    return (orgs ?? []).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs]);

  const { addToast } = useToast();
  const handleSwitch = async (orgId: string) => {
    if (!orgId || orgId === currentOrgId) return;
    await switchOrg.mutateAsync(orgId);
    addToast("Switched organization", "success");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Organization</p>
          <p className="text-xs text-gray-400">
            {sortedOrgs.find((o) => o.id === currentOrgId)?.name ?? "Default"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedOrgs.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => handleSwitch(org.id)}
            className={`px-3 py-1 rounded text-sm border ${
              org.id === currentOrgId
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-100 hover:border-indigo-400"
            }`}
          >
            {org.name}
            <span className="ml-2 text-xs text-slate-300">({org.membershipRole})</span>
          </button>
        ))}
        {sortedOrgs.length === 0 && (
          <span className="text-xs text-slate-400">No organizations yet</span>
        )}
      </div>

    </div>
  );
}
