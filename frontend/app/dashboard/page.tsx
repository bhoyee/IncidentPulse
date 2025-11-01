"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import {
  AdjustmentsHorizontalIcon,
  ArrowRightIcon,
  PlusIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
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
  const openCount = useMemo(
    () => incidents.filter((incident) => incident.status !== "resolved").length,
    [incidents]
  );
  const criticalCount = useMemo(
    () =>
      incidents.filter(
        (incident) => incident.status !== "resolved" && incident.severity === "critical"
      ).length,
    [incidents]
  );

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

  const viewerName = session?.name ?? "Team";
  const quickActions = [
    {
      label: "Log incident",
      description: "Capture impact & assign responders",
      href: "#new-incident",
      icon: PlusIcon,
      disabled: !canCreate
    },
    {
      label: "Status page",
      description: "Check customer-facing comms",
      href: "/status",
      icon: SparklesIcon,
      disabled: false
    },
    {
      label: "Tweak filters",
      description: "Severity, ownership & team roles",
      href: "#incident-filters",
      icon: AdjustmentsHorizontalIcon,
      disabled: false
    }
  ];

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <AuthGuard>
      <div className="relative min-h-screen bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.35),_transparent_55%)]" />
        <div className="relative mx-auto w-[95%] max-w-[1600px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-10 text-slate-100 shadow-2xl sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div className="max-w-2xl space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300/80">
                  Command center
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Welcome back, {viewerName}.
                </h1>
                <p className="max-w-xl text-sm text-slate-300">
                  Monitor live incidents, collaborate with responders, and keep the status page shining.
                  Critical signals are surfaced automatically so the team can stay ahead.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3 text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-200">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  {openCount} active · {criticalCount} critical
                </div>
                <div className="text-xs text-slate-400">
                  Data refreshes every few minutes · Manual overrides available
                </div>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const content = (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>
                      <span className="text-sm font-semibold text-slate-100">{action.label}</span>
                      <span className="mt-1 block text-xs text-slate-300">{action.description}</span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-100 transition group-hover:bg-white/20">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                );

                if (action.disabled) {
                  return (
                    <div
                      key={action.label}
                      className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-slate-300 opacity-60"
                    >
                      {content}
                    </div>
                  );
                }

                return action.href.startsWith("#") ? (
                  <a
                    key={action.label}
                    href={action.href}
                    className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-slate-200 transition hover:border-indigo-300/40 hover:bg-white/10"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={action.label}
                    href={action.href as Route}
                    className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-slate-200 transition hover:border-indigo-300/40 hover:bg-white/10"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="mt-10 space-y-10">
            <DashboardStats incidents={incidents} metrics={metricsQuery.data} />

            <section className="space-y-8">
              <div
                id="incident-filters"
                className="rounded-3xl border border-white/15 bg-white/80 p-6 shadow-xl backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-6">
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
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Assignee
                        <div className="relative">
                          <select
                            value={assigneeFilter ?? ""}
                            onChange={(event) =>
                              setAssigneeFilter(
                                event.target.value ? event.target.value : undefined
                              )
                            }
                            className="appearance-none rounded-full border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ArrowRightIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span>Use the quick filters to focus the queue.</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {filterChips.length === 0 ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      No filters applied
                    </span>
                  ) : (
                    filterChips.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={chip.onClear}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-3 py-1 text-slate-600 transition hover:bg-indigo-100"
                      >
                        {chip.label}
                        <span aria-hidden="true">×</span>
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

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1fr)]">
                <NewIncidentForm
                  disabled={!canCreate}
                  canAssign={Boolean(isAdmin)}
                  assignees={teamUsers}
                  currentUserId={session?.id ?? ""}
                />
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-sm text-slate-200 shadow-xl">
                  <h3 className="text-sm font-semibold text-white">Today&apos;s playbook</h3>
                  <ul className="mt-4 space-y-3 text-xs text-slate-300">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                      Respond to new incidents within 15 minutes.
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
                      Keep customers informed every 30 minutes with status notes.
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                      Resolve critical incidents under 2 hours and capture lessons learned.
                    </li>
                  </ul>
                </div>
              </div>

              {isAdmin ? (
                <TeamManagementPanel
                  id="team-roster"
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
            </section>
          </div>
        </div>

        <footer className="mx-auto w-[95%] max-w-[1600px] px-4 pb-10 text-xs text-slate-500 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span>© {year} IncidentPulse. Built for resilient teams.</span>
            <div className="flex flex-wrap gap-4 text-slate-400">
              <Link className="transition hover:text-slate-200" href={"/status" as Route}>
                Status
              </Link>
              <a className="transition hover:text-slate-200" href="mailto:support@incidentpulse.com">
                Support
              </a>
              <a className="transition hover:text-slate-200" href="#">
                Docs
              </a>
            </div>
          </div>
        </footer>
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
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {label}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? (event.target.value as T) : undefined)}
          className="appearance-none rounded-full border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
