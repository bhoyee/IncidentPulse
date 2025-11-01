"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { AuthGuard } from "@components/AuthGuard";
import { DashboardStats } from "@components/DashboardStats";
import { IncidentsTable } from "@components/IncidentsTable";
import { IncidentDrawer } from "@components/IncidentDrawer";
import { NewIncidentForm } from "@components/NewIncidentForm";
import { useIncidents } from "@hooks/useIncidents";
import { useMetrics } from "@hooks/useMetrics";
import { useSession } from "@hooks/useSession";
import {
  useTeamUsers,
  type TeamUser,
  type TeamUsersResponse
} from "@hooks/useTeamUsers";
import type { Incident, IncidentSeverity, IncidentStatus } from "@lib/types";
import { TeamManagementPanel } from "@components/TeamManagementPanel";

const statusFilters: IncidentStatus[] = ["open", "investigating", "monitoring", "resolved"];
const severityFilters: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_TEAM_USERS: TeamUser[] = [];

export default function DashboardPage() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>();
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>();
  const [teamRoleFilter, setTeamRoleFilter] = useState<string | undefined>();
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>();
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPage, setTeamPage] = useState(1);
  const teamPageSize = 25;

  const { data: session } = useSession();
  const isAdmin = session?.role === "admin";
  const isOperator = session?.role === "operator";
  const canCreate = Boolean(isAdmin || isOperator);

  useEffect(() => {
    if (!isAdmin) {
      setTeamSearch("");
      setTeamPage(1);
    }
  }, [isAdmin]);

  const teamUsersQuery = useTeamUsers(Boolean(isAdmin), {
    search: teamSearch.trim().length >= 2 ? teamSearch.trim() : undefined,
    page: teamPage,
    pageSize: teamPageSize
  });
  const teamUsersResponse = teamUsersQuery.data as TeamUsersResponse | undefined;
  const teamUsers = teamUsersResponse?.data ?? EMPTY_TEAM_USERS;
  const teamUsersMeta = teamUsersResponse?.meta;

  useEffect(() => {
    if (!isAdmin || !teamUsersMeta) {
      return;
    }
    const maxPage = Math.max(teamUsersMeta.totalPages, 1);
    if (teamPage > maxPage) {
      setTeamPage(maxPage);
    }
  }, [isAdmin, teamUsersMeta, teamPage]);

  const incidentFilters = useMemo(
    () => ({
      status: statusFilter,
      severity: severityFilter,
      teamRole: teamRoleFilter,
      assignedTo: isAdmin ? assigneeFilter : undefined
    }),
    [statusFilter, severityFilter, teamRoleFilter, assigneeFilter, isAdmin]
  );

  const incidentsQuery = useIncidents(incidentFilters);
  const metricsQuery = useMetrics();

  const incidents = incidentsQuery.data?.data ?? EMPTY_INCIDENTS;
  const teamRoleOptions = useMemo(() => {
    const roles = new Set<string>();
    teamUsers.forEach((user) => user.teamRoles.forEach((role) => roles.add(role)));
    incidents.forEach((incident) => {
      incident.assignedTo?.teamRoles.forEach((role) => roles.add(role));
      incident.createdBy?.teamRoles.forEach((role) => roles.add(role));
    });
    return Array.from(roles).sort();
  }, [teamUsers, incidents]);

  const assigneeOptions = useMemo(() => {
    return teamUsers.filter((user) => user.isActive);
  }, [teamUsers]);

  const filterChips = useMemo(() => {
    const chips: Array<{ label: string; onClear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        label: `Status: ${statusFilter}`,
        onClear: () => setStatusFilter(undefined)
      });
    }
    if (severityFilter) {
      chips.push({
        label: `Severity: ${severityFilter}`,
        onClear: () => setSeverityFilter(undefined)
      });
    }
    if (teamRoleFilter) {
      chips.push({
        label: `Team role: ${teamRoleFilter}`,
        onClear: () => setTeamRoleFilter(undefined)
      });
    }
    if (assigneeFilter) {
      const assigneeName =
        assigneeOptions.find((user) => user.id === assigneeFilter)?.name ?? "Assignee";
      chips.push({
        label: `Assigned to: ${assigneeName}`,
        onClear: () => setAssigneeFilter(undefined)
      });
    }
    return chips;
  }, [statusFilter, severityFilter, teamRoleFilter, assigneeFilter, assigneeOptions]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <DashboardStats incidents={incidents} metrics={metricsQuery.data} />

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  options={statusFilters}
                  onChange={(status) => setStatusFilter(status)}
                />
                <FilterSelect
                  label="Severity"
                  value={severityFilter}
                  options={severityFilters}
                  onChange={(severity) => setSeverityFilter(severity)}
                />
                {teamRoleOptions.length > 0 ? (
                  <FilterSelect
                    label="Team role"
                    value={teamRoleFilter}
                    options={teamRoleOptions}
                    onChange={(role) => setTeamRoleFilter(role)}
                  />
                ) : null}
                {isAdmin ? (
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assignee
                    <div className="relative">
                      <select
                        value={assigneeFilter ?? ""}
                        onChange={(event) =>
                          setAssigneeFilter(event.target.value ? event.target.value : undefined)
                        }
                        className="appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">Any</option>
                        {assigneeOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {filterChips.length === 0 ? (
                  <span>No filters applied</span>
                ) : (
                  filterChips.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={chip.onClear}
                      className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 transition hover:bg-slate-200"
                    >
                      {chip.label} x
                    </button>
                  ))
                )}
              </div>
            </div>

            <IncidentsTable
              incidents={incidents}
              onSelect={(incident) => setSelectedIncident(incident)}
              currentUserId={session?.id ?? ""}
              isAdmin={Boolean(isAdmin)}
            />
          </div>

          <div className="space-y-4">
            <NewIncidentForm
              disabled={!canCreate}
              canAssign={Boolean(isAdmin)}
              assignees={teamUsers}
              currentUserId={session?.id ?? ""}
            />
            {isAdmin ? (
              <TeamManagementPanel
                users={teamUsers}
                meta={teamUsersMeta}
                isLoading={teamUsersQuery.isLoading}
                isRefetching={teamUsersQuery.isFetching}
                search={teamSearch}
                onSearchChange={setTeamSearch}
                page={teamPage}
                onPageChange={setTeamPage}
                pageSize={teamPageSize}
              />
            ) : null}
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Today&apos;s goals</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                <li>Respond to new incidents within 15 minutes.</li>
                <li>Keep customers informed every 30 minutes.</li>
                <li>Resolve critical incidents under 2 hours.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <IncidentDrawer
        incidentId={selectedIncident?.id}
        open={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        currentUser={{
          id: session?.id ?? "",
          role: session?.role ?? "viewer"
        }}
        teamUsers={teamUsers}
      />
    </AuthGuard>
  );
}

type FilterSelectProps<T extends string> = {
  label: string;
  value?: T;
  options: readonly T[];
  onChange: (value: T | undefined) => void;
};

function FilterSelect<T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? (event.target.value as T) : undefined)}
          className="appearance-none rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Any</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}
