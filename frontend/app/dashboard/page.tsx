"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";
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
  const [activeTab, setActiveTab] = useState<"incidents" | "team">("incidents");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false); // NEW STATE
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

  // Calculate stats
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
  const activeIncidents = incidents.filter(i => i.status !== 'resolved').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and title */}
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">⚡</span>
                  </div>
                  <span className="ml-3 text-xl font-bold text-gray-900">IncidentPulse</span>
                </div>
                
                {/* Desktop Navigation */}
                <nav className="hidden md:ml-8 md:flex space-x-8">
                  <button
                    onClick={() => setActiveTab("incidents")}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      activeTab === "incidents"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Incidents
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab("team")}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        activeTab === "team"
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      Team Management
                    </button>
                  )}
                </nav>
              </div>

              {/* User menu and mobile button */}
              <div className="flex items-center">
                {/* New Incident Button - NOW WITH CLICK HANDLER */}
                {canCreate && (
                  <button 
                    onClick={() => setIsNewIncidentOpen(true)}
                    className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-4"
                  >
                    + New Incident
                  </button>
                )}

                {/* User profile */}
                <div className="flex items-center">
                  <div className="hidden sm:flex sm:flex-col sm:items-end sm:mr-4">
                    <div className="text-sm font-medium text-gray-900">{session?.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{session?.role}</div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white">
                    <span className="text-blue-600 text-sm font-medium">
                      {session?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Mobile menu button */}
                <div className="md:hidden ml-4">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  >
                    {mobileMenuOpen ? (
                      <XMarkIcon className="block h-6 w-6" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab("incidents");
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                    activeTab === "incidents"
                      ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  Incidents
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab("team");
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                      activeTab === "team"
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    Team Management
                  </button>
                )}
                {canCreate && (
                  <button 
                    onClick={() => {
                      setIsNewIncidentOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    + New Incident
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Main Content - Full Width */}
        <main className="max-w-full mx-auto pb-8">
          {/* Stats Overview */}
          <div className="px-4 sm:px-6 lg:px-8 mt-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Incidents */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                      <div className="h-6 w-6 text-blue-600">📊</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Incidents</dt>
                        <dd className="text-lg font-semibold text-gray-900">{incidents.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Incidents */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                      <div className="h-6 w-6 text-orange-600">🔥</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active</dt>
                        <dd className="text-lg font-semibold text-gray-900">{activeIncidents}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Critical */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                      <div className="h-6 w-6 text-red-600">🚨</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Critical</dt>
                        <dd className="text-lg font-semibold text-gray-900">{criticalIncidents}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resolved */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                      <div className="h-6 w-6 text-green-600">✅</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Resolved</dt>
                        <dd className="text-lg font-semibold text-gray-900">{resolvedIncidents}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="px-4 sm:px-6 lg:px-8 mt-6">
            <div className="bg-white shadow rounded-lg">
              {/* Tab Content */}
              {activeTab === "incidents" ? (
                <div className="p-6">
                  {/* Header and Filters */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Incident Management</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Monitor and manage all system incidents in real-time
                      </p>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="mt-4 lg:mt-0 flex flex-wrap gap-3">
                      {canCreate && (
                        <button 
                          onClick={() => setIsNewIncidentOpen(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          + New Incident
                        </button>
                      )}
                      
                      {/* Filter Toggles */}
                      <div className="flex items-center space-x-2">
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
                      </div>
                    </div>
                  </div>

                  {/* Active Filters */}
                  {filterChips.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-500">Active filters:</span>
                      {filterChips.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={chip.onClear}
                          className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 transition-colors"
                        >
                          {chip.label}
                          <span className="ml-1.5 text-blue-600">×</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Incidents Table */}
                  <div className="mt-6">
                    <IncidentsTable
                      incidents={incidents}
                      onSelect={(incident) => setSelectedIncident(incident)}
                      currentUserId={session?.id ?? ""}
                      isAdmin={Boolean(isAdmin)}
                    />
                  </div>
                </div>
              ) : (
                /* Team Management Tab */
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Team Management</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Manage team members and their roles
                      </p>
                    </div>
                    
                    {/* Team Search */}
                    <div className="mt-4 lg:mt-0">
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        className="block w-full lg:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Team Management Panel */}
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
                </div>
              )}
            </div>

            {/* Quick Create Card for Mobile */}
            <div className="mt-6 lg:hidden">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <button 
                  onClick={() => setIsNewIncidentOpen(true)}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  + Create New Incident
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center">
                <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center mr-2">
                  <span className="text-white text-xs font-bold">⚡</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">IncidentPulse</span>
              </div>
              
              <div className="mt-4 md:mt-0">
                <p className="text-center text-sm text-gray-500">
                  &copy; {new Date().getFullYear()} IncidentPulse. All rights reserved.
                </p>
              </div>
              
              <div className="mt-4 md:mt-0 flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Privacy Policy</span>
                  <span className="text-sm">Privacy</span>
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Terms of Service</span>
                  <span className="text-sm">Terms</span>
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Support</span>
                  <span className="text-sm">Support</span>
                </a>
              </div>
            </div>
          </div>
        </footer>

        {/* Incident Drawer for viewing/editing */}
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

        {/* NEW: Modal for creating incidents */}
        {isNewIncidentOpen && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-end justify-center min-h-full pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                onClick={() => setIsNewIncidentOpen(false)}
              ></div>

              {/* Modal panel */}
              <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => setIsNewIncidentOpen(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Create New Incident
                    </h3>
                    <NewIncidentForm
                      disabled={!canCreate}
                      canAssign={Boolean(isAdmin)}
                      assignees={teamUsers}
                      currentUserId={session?.id ?? ""}
                      onSuccess={() => setIsNewIncidentOpen(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? (event.target.value as T) : undefined)}
          className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All {label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}