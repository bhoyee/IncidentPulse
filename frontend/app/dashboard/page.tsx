"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, Bars3Icon, XMarkIcon, ChevronRightIcon, PencilIcon, TrashIcon, KeyIcon, XMarkIcon as XIcon } from "@heroicons/react/24/solid";
import { AuthGuard } from "@components/AuthGuard";
import { IncidentsTable } from "@components/IncidentsTable";
import { IncidentDrawer } from "@components/IncidentDrawer";
import { NewIncidentForm } from "@components/NewIncidentForm";
import { ChangePasswordCard } from "@components/ChangePasswordCard";
import { IntegrationsPanel } from "@components/IntegrationsPanel";
import { useIncidents } from "@hooks/useIncidents";
import { useSession } from "@hooks/useSession";
import type { SessionUser } from "@hooks/useSession";
import { useLogout } from "@hooks/useLogout";
import {
  useTeamUsers,
  type TeamUser,
  type TeamUsersResponse
} from "@hooks/useTeamUsers";
import {
  useIntegrationSettings,
  useUpdateIntegrationSettings,
  type IntegrationSettings
} from "@hooks/useIntegrationSettings";
import type { Incident, IncidentSeverity, IncidentStatus } from "@lib/types";
import { TeamManagementPanel } from "@components/TeamManagementPanel";

type DashboardTab = "incidents" | "team" | "password" | "webhooks";

const statusFilters: IncidentStatus[] = ["open", "investigating", "monitoring", "resolved"];
const severityFilters: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_TEAM_USERS: TeamUser[] = [];
const DEMO_ACCOUNT_EMAILS = new Set([
  "admin@demo.incidentpulse.com",
  "operator@demo.incidentpulse.com"
]);

// Mock functions for CRUD operations - replace with your actual implementations
const mockUpdateUser = async (userId: string, updates: Partial<TeamUser>) => {
  console.log('Updating user:', userId, updates);
  return Promise.resolve();
};

const mockDeleteUser = async (userId: string) => {
  console.log('Deleting user:', userId);
  return Promise.resolve();
};

const mockResetPassword = async (userId: string) => {
  console.log('Resetting password for user:', userId);
  return Promise.resolve();
};

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentIdFromQuery = searchParams.get("incidentId");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>();
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>();
  const [teamRoleFilter, setTeamRoleFilter] = useState<string | undefined>();
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>();
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPage, setTeamPage] = useState(1);
  const [activeTab, setActiveTab] = useState<DashboardTab>("incidents");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<TeamUser>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const teamPageSize = 25;

  const { data: session } = useSession();
  const logout = useLogout();
  const isAdmin = session?.role === "admin";
  const isOperator = session?.role === "operator";
  const canCreate = Boolean(isAdmin || isOperator);
  const isDemoAccount = session?.email
    ? DEMO_ACCOUNT_EMAILS.has(session.email.toLowerCase())
    : false;
  const canChangePassword = Boolean((isAdmin || isOperator) && !isDemoAccount);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const webhookBase = (apiBase || "https://your-backend.example.com").replace(/\/$/, "");
  const alertEndpoint = `${webhookBase}/webhooks/incidents`;
  const recoveryEndpoint = `${webhookBase}/webhooks/incidents/recovery`;
  const integrationSettingsQuery = useIntegrationSettings(
    Boolean(isAdmin && activeTab === "webhooks")
  );
  const updateIntegrationSettings = useUpdateIntegrationSettings();

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
  const incidents = incidentsQuery.data?.data ?? EMPTY_INCIDENTS;
  const assigneeOptions = useMemo(() => {
    return teamUsers.filter((user) => user.isActive);
  }, [teamUsers]);

  useEffect(() => {
    if (incidentIdFromQuery) {
      setSelectedIncidentId(incidentIdFromQuery);
    } else {
      setSelectedIncidentId(null);
    }
  }, [incidentIdFromQuery]);

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

  const handleIncidentSelect = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
    router.replace(`/dashboard?incidentId=${incident.id}`, { scroll: false });
  };

  const handleIncidentDrawerClose = () => {
    setSelectedIncidentId(null);
    router.replace("/dashboard", { scroll: false });
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
    setEditingUser(null);
    setEditFormData({});
  };

  const startEditing = (user: TeamUser, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingUser(user.id);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      teamRoles: [...user.teamRoles],
      isActive: user.isActive
    });
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingUser(null);
    setEditFormData({});
  };

const saveEditing = async (userId: string, e?: React.MouseEvent) => {
  e?.stopPropagation();
  try {
    await mockUpdateUser(userId, editFormData);
    setEditingUser(null);
    setEditFormData({});
    // Refresh the team users data
    teamUsersQuery.refetch();
  } catch (error) {
    console.error('Failed to update user:', error);
  }
};

  const handleIntegrationSettingsSave = async (values: Partial<IntegrationSettings>) => {
    await updateIntegrationSettings.mutateAsync(values);
  };

  const handleDeleteUser = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      setIsDeleting(userId);
      try {
        await mockDeleteUser(userId);
        // Refresh the team users data
        teamUsersQuery.refetch();
      } catch (error) {
        console.error('Failed to delete user:', error);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleResetPassword = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to reset this user\'s password? They will receive an email with instructions to set a new password.')) {
      try {
        await mockResetPassword(userId);
        alert('Password reset email has been sent to the user.');
      } catch (error) {
        console.error('Failed to reset password:', error);
      }
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTeamRoleChange = (role: string, checked: boolean) => {
    setEditFormData(prev => {
      const currentRoles = prev.teamRoles || [];
      const newRoles = checked 
        ? [...currentRoles, role]
        : currentRoles.filter(r => r !== role);
      
      return {
        ...prev,
        teamRoles: newRoles
      };
    });
  };

  // Available roles for the role selector
  const availableRoles = ['admin', 'operator', 'viewer'];
  const availableTeamRoles = ['Frontend', 'Backend', 'DevOps', 'Security', 'Support', 'Manager'];
  const firstName = session?.name?.split(" ")[0] ?? "there";

  const baseSidebarItems: Array<{
    id: DashboardTab;
    label: string;
    description: string;
    adminOnly?: boolean;
    requiresPassword?: boolean;
  }> = [
    { id: "incidents", label: "Incidents", description: "Live incident feed" },
    { id: "team", label: "Team", description: "Manage roles & assignments", adminOnly: true },
    { id: "webhooks", label: "Automation", description: "Webhooks & notifications", adminOnly: true },
    { id: "password", label: "Security", description: "Update password", requiresPassword: true }
  ];

  const sidebarNavItems = baseSidebarItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiresPassword && !canChangePassword) return false;
    return true;
  });

  return (
    <AuthGuard>

      <DashboardShell
        session={session}
        canCreate={canCreate}
        onNewIncident={() => setIsNewIncidentOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={(open) => setMobileMenuOpen(open)}
        sidebarNavItems={sidebarNavItems}
        stats={{
          total: incidents.length,
          active: activeIncidents,
          critical: criticalIncidents,
          resolved: resolvedIncidents
        }}
        firstName={firstName}
        logout={logout}
      >
        {activeTab === "incidents" && (
          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Incident management</h2>
                <p className="text-sm text-gray-600">
                  Track investigations, assignments, and customer messaging in one view.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
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
                <FilterSelect
                  label="Team role"
                  value={teamRoleFilter}
                  options={availableTeamRoles as readonly string[]}
                  onChange={(role) => setTeamRoleFilter(role)}
                />
                <div className="flex min-w-[180px] flex-col">
                  <label className="mb-1 text-xs font-medium text-gray-500">Assignee</label>
                  <div className="relative">
                    <select
                      value={assigneeFilter ?? ""}
                      onChange={(event) => setAssigneeFilter(event.target.value || undefined)}
                      className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">All assignees</option>
                      {assigneeOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
                Automate intake with secure webhooks and send Slack or Telegram alerts from the Integrations tab.
              </div>
            ) : null}

            {filterChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <span className="text-sm text-gray-500">Active filters:</span>
                {filterChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.onClear}
                    className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 transition hover:bg-blue-200"
                  >
                    {chip.label}
                    <span className="ml-1.5 text-blue-600">x</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-6 overflow-x-auto">
              <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden rounded-xl border border-gray-100 shadow">
                  <IncidentsTable
                    incidents={incidents}
                    onSelect={handleIncidentSelect}
                    currentUserId={session?.id ?? ""}
                    isAdmin={Boolean(isAdmin)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "team" && isAdmin && (
          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Team management</h2>
                <p className="text-sm text-gray-600">Invite responders, manage roles, and keep audit trails clean.</p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-64"
                />
              </div>
            </div>

            <div className="mt-6 space-y-4 md:hidden">
              {teamUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  No team members found.
                </div>
              ) : (
                teamUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`rounded-2xl border p-4 transition ${
                      expandedUser === user.id ? "border-blue-300 shadow" : "border-gray-200 shadow-sm"
                    }`}
                    onClick={() => toggleUserExpansion(user.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {user.role}
                      </span>
                    </div>
                    {expandedUser === user.id ? (
                      <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 text-sm text-gray-700">
                        {editingUser === user.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              <label className="space-y-1 text-sm font-medium text-gray-700">
                                Name
                                <input
                                  type="text"
                                  value={editFormData.name || ""}
                                  onChange={(event) => handleInputChange("name", event.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                              <label className="space-y-1 text-sm font-medium text-gray-700">
                                Email
                                <input
                                  type="email"
                                  value={editFormData.email || ""}
                                  onChange={(event) => handleInputChange("email", event.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                              <label className="space-y-1 text-sm font-medium text-gray-700">
                                Role
                                <select
                                  value={editFormData.role || user.role}
                                  onChange={(event) => handleInputChange("role", event.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {availableRoles.map((role) => (
                                    <option key={role} value={role}>
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editFormData.isActive ?? user.isActive)}
                                  onChange={(event) => handleInputChange("isActive", event.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                Active account
                              </label>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500">Team roles</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {availableTeamRoles.map((role) => {
                                  const checked = (editFormData.teamRoles || user.teamRoles).includes(role);
                                  return (
                                    <label
                                      key={role}
                                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                        checked ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => handleTeamRoleChange(role, event.target.checked)}
                                        className="mr-2 h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      {role}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={(event) => cancelEditing(event)}
                                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={(event) => saveEditing(user.id, event)}
                                className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                              >
                                Save changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs uppercase text-gray-400">Status</p>
                                <p className="font-semibold text-gray-900">
                                  {user.isActive ? "Active" : "Suspended"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase text-gray-400">Role</p>
                                <p className="font-semibold text-gray-900 capitalize">{user.role}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-400">Team roles</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {user.teamRoles.length === 0 ? (
                                  <span className="text-xs text-gray-500">None assigned</span>
                                ) : (
                                  user.teamRoles.map((role) => (
                                    <span key={role} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                      {role}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                              <div>
                                <p className="uppercase tracking-wide text-gray-400">Last active</p>
                                <p className="text-gray-900 text-sm">
                                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : "Never"}
                                </p>
                              </div>
                              <div>
                                <p className="uppercase tracking-wide text-gray-400">Created</p>
                                <p className="text-gray-900 text-sm">
                                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 border-t pt-3">
                              <button
                                type="button"
                                onClick={(event) => startEditing(user, event)}
                                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"
                              >
                                <PencilIcon className="mr-1 h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => handleResetPassword(user.id, event)}
                                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"
                              >
                                <KeyIcon className="mr-1 h-4 w-4" />
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={(event) => handleDeleteUser(user.id, event)}
                                disabled={isDeleting === user.id}
                                className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <TrashIcon className="mr-1 h-4 w-4" />
                                {isDeleting === user.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block">
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
          </div>
        )}

        {activeTab === "webhooks" && isAdmin && (
          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm space-y-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-800">Automation</p>
                  <h2 className="text-xl font-semibold text-blue-950">Webhooks & integrations</h2>
                  <p className="text-sm text-blue-900">
                    Create or resolve incidents from monitoring tools and broadcast lifecycle updates to Slack or Telegram.
                  </p>
                </div>
                <Link
                  href="/docs#webhooks"
                  className="inline-flex items-center text-sm font-semibold text-blue-800 underline"
                >
                  Open documentation
                  <ChevronRightIcon className="ml-1.5 h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Alert endpoint</p>
                  <code className="mt-2 block break-all rounded-xl border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-900">
                    {alertEndpoint}
                  </code>
                  <p className="mt-2 text-xs text-blue-800">
                    Sign requests with <span className="font-mono">X-Signature</span> (HMAC-SHA256) or include the fallback <span className="font-mono">X-Webhook-Token</span> header.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Recovery endpoint</p>
                  <code className="mt-2 block break-all rounded-xl border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-900">
                    {recoveryEndpoint}
                  </code>
                  <p className="mt-2 text-xs text-blue-800">
                    Send the matching <span className="font-mono">fingerprint</span> to resolve incidents and notify subscribers.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 text-xs text-blue-900 lg:grid-cols-2">
                <div>
                  Required headers: <span className="font-mono">X-Signature</span> or <span className="font-mono">X-Webhook-Token</span>. Include <span className="font-mono">X-Idempotency-Key</span> to dedupe retries.
                </div>
                <div>
                  Dedupe window 10 minutes · rate limit 60 req/min · metrics via <span className="font-mono">GET /metrics/webhook</span>.
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
                <h3 className="text-base font-semibold text-gray-900">Secrets to configure</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <span className="font-mono text-xs">WEBHOOK_HMAC_SECRET</span>  generate once (for example <code className="font-mono text-xs">openssl rand -hex 32</code>) and store it in Render &gt; Environment.
                  </li>
                  <li>
                    <span className="font-mono text-xs">WEBHOOK_SHARED_TOKEN</span>  optional fallback header for trusted internal scripts.
                  </li>
                  <li>
                    <span className="font-mono text-xs">WEBHOOK_SYSTEM_USER_ID</span>  operator id used when the platform appends automated updates.
                  </li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  Secrets are never displayed in the dashboard. Copy the values directly from Render when onboarding new tooling.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
                <h3 className="text-base font-semibold text-gray-900">Sample alert payload</h3>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900/90 p-3 font-mono text-xs text-gray-50">
{`curl -X POST ${alertEndpoint} \
  -H "Content-Type: application/json" \
  -H "X-Signature: <hex-hmac>" \
  -d '{"service":"checkout-api","environment":"production","eventType":"error_spike","severity":"high","fingerprint":"checkout|production|error_spike"}'`}
                </pre>
                <p className="mt-2 text-xs text-gray-500">
                  Include <span className="font-mono">occurredAt</span> (UTC ISO string) to control dedupe timing and SLA calculations.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white">
              <IntegrationsPanel
                settings={integrationSettingsQuery.data}
                isLoading={integrationSettingsQuery.isLoading}
                onSave={handleIntegrationSettingsSave}
                isSaving={updateIntegrationSettings.isPending}
              />
            </div>
          </div>
        )}

        {activeTab === "password" && canChangePassword && (
          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900">Security</h2>
              <p className="text-sm text-gray-600">Keep your operator account secure with a strong password.</p>
              <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <ChangePasswordCard className="bg-white" />
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
        {/* Incident Drawer for viewing/editing */}
        <IncidentDrawer
          incidentId={selectedIncidentId ?? undefined}
          open={Boolean(selectedIncidentId)}
          onClose={handleIncidentDrawerClose}
          currentUser={{
            id: session?.id ?? "",
            role: session?.role ?? "viewer"
          }}
          teamUsers={teamUsers}
        />

        {/* Modal for creating incidents */}
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
                      onSuccess={() => setIsNewIncidentOpen(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </AuthGuard>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading dashboard...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

type StatsSummary = {
  total: number;
  active: number;
  critical: number;
  resolved: number;
};

type DashboardShellProps = {
  session?: SessionUser | null;
  canCreate: boolean;
  onNewIncident: () => void;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  sidebarNavItems: Array<{ id: DashboardTab; label: string; description: string }>;
  stats: StatsSummary;
  firstName: string;
  logout: ReturnType<typeof useLogout>;
  children: ReactNode;
};

function DashboardShell({
  session,
  canCreate,
  onNewIncident,
  activeTab,
  onTabChange,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarNavItems,
  stats,
  firstName,
  logout,
  children
}: DashboardShellProps) {
  const handleNavClick = (tab: DashboardTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-xl transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              IP
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">IncidentPulse</p>
              <p className="text-lg font-semibold text-gray-900">Control Center</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-gray-500 transition hover:bg-gray-50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100%-5rem)] flex-col">
          <div className="px-6 pt-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Workspace</p>
            <div className="mt-3 space-y-2">
              {sidebarNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.id === "incidents" ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isActive ? "bg-white/80 text-blue-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {stats.active}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-normal text-gray-500">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-gray-100 px-6 py-6 text-sm text-gray-600">
            <div className="space-y-2">
              <Link
                href="/docs"
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 transition hover:border-blue-500 hover:text-blue-600"
              >
                <span>Documentation</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/status"
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 transition hover:border-blue-500 hover:text-blue-600"
              >
                <span>Status Page</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 font-semibold text-gray-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{logout.isPending ? "Signing out..." : "Logout"}</span>
                <XIcon className="h-4 w-4" />
              </button>
              {logout.isError ? (
                <p className="text-xs text-red-600">Failed to sign out. Please try again.</p>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-72">
        <header className="border-b border-gray-100 bg-white/90 px-4 py-4 shadow-sm backdrop-blur sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Hello, {firstName}</p>
              <h1 className="text-2xl font-semibold text-gray-900">Incident Operations</h1>
              <p className="text-sm text-gray-500">
                Monitor incidents, manage responders, and automate communications.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {session?.role ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                  {session.role}
                </span>
              ) : null}
              {canCreate ? (
                <button
                  type="button"
                  onClick={onNewIncident}
                  className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  + New incident
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-10">
          <section>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total incidents" value={stats.total} />
              <StatCard label="Active incidents" value={stats.active} />
              <StatCard label="Critical incidents" value={stats.critical} />
              <StatCard label="Resolved" value={stats.resolved} />
            </div>
          </section>
          <section className="space-y-8">{children}</section>
        </main>
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
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
    <div className="flex flex-col min-w-[120px]">
      <label className="text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? (event.target.value as T) : undefined)}
          className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
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
