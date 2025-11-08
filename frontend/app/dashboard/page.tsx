"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, Bars3Icon, XMarkIcon, ChevronRightIcon, ChevronLeftIcon, PencilIcon, TrashIcon, KeyIcon, CheckIcon, XMarkIcon as XIcon } from "@heroicons/react/24/solid";
import { AuthGuard } from "@components/AuthGuard";
import { IncidentsTable } from "@components/IncidentsTable";
import { IncidentDrawer } from "@components/IncidentDrawer";
import { NewIncidentForm } from "@components/NewIncidentForm";
import { ChangePasswordCard } from "@components/ChangePasswordCard";
import { IntegrationsPanel } from "@components/IntegrationsPanel";
import { useIncidents } from "@hooks/useIncidents";
import { useSession } from "@hooks/useSession";
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
  const [activeTab, setActiveTab] = useState<"incidents" | "team" | "password" | "webhooks">(
    "incidents"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<TeamUser>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const teamPageSize = 25;

  const { data: session } = useSession();
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
  const isWebhooksTab = activeTab === "webhooks";

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
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab("webhooks")}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      activeTab === "webhooks"
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Webhooks
                  </button>
                )}
                {canChangePassword && (
                  <button
                    onClick={() => setActiveTab("password")}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      activeTab === "password"
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      Change Password
                    </button>
                  )}
                </nav>
              </div>

              {/* User menu and mobile button */}
              <div className="flex items-center">
                {/* New Incident Button */}
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
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab("webhooks");
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                      activeTab === "webhooks"
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    Webhooks
                  </button>
                )}
                {canChangePassword && (
                  <button
                    onClick={() => {
                      setActiveTab("password");
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                      activeTab === "password"
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    Change Password
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
                <div className="p-4 sm:p-6">
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
                      <div className="flex flex-wrap gap-2">
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

                  {isAdmin && (
                    <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-blue-800">Webhook automation</h3>
                          <p className="text-xs text-blue-700 mt-1">
                            Pipe alerts from monitoring tools directly into IncidentPulse and close incidents automatically when systems recover.
                          </p>
                        </div>
                        <Link
                          href="/docs#webhooks"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 underline hover:text-blue-900"
                        >
                          View webhook guide →
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Alert endpoint</p>
                          <code className="mt-1 block break-all rounded border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-800">
                            {alertEndpoint}
                          </code>
                          <p className="mt-2 text-xs text-blue-700">
                            Authenticate with <span className="font-mono">X-Signature</span> (HMAC-SHA256) or the fallback{" "}
                            <span className="font-mono">X-Webhook-Token</span>.
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Recovery endpoint</p>
                          <code className="mt-1 block break-all rounded border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-800">
                            {recoveryEndpoint}
                          </code>
                          <p className="mt-2 text-xs text-blue-700">
                            Include the matching <span className="font-mono">fingerprint</span> to resolve incidents and notify the assignee.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs text-blue-700 lg:grid-cols-2">
                        <div>
                          Required env: <span className="font-mono">WEBHOOK_HMAC_SECRET</span>. Optional:{" "}
                          <span className="font-mono">WEBHOOK_SHARED_TOKEN</span>, <span className="font-mono">WEBHOOK_SYSTEM_USER_ID</span>.
                        </div>
                        <div>
                          Rate limit 60 req/min per token, <span className="font-mono">occurredAt</span> skew ±10 min, metrics via{" "}
                          <span className="font-mono">GET /metrics/webhook</span>.
                        </div>
                      </div>


                      <p className="mt-3 text-xs text-blue-700">
                        Generate the HMAC secret once (for example <span className="font-mono">openssl rand -hex 32</span>), store it in your Render environment, and share it with monitoring tools through a secure channel. The dashboard never exposes secret values to reduce leakage risk.
                      </p>

                    </div>
                  )}

                  {/* Mobile Optimized Incidents Table */}
                  <div className="mt-6 overflow-x-auto">
                    <div className="min-w-full inline-block align-middle">
                      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
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
                    ) : activeTab === "team" ? (
                      /* Team Management Tab - Mobile Optimized */
                      <div className="p-4 sm:p-6">
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

                  {/* Mobile Team Cards */}
                  <div className="md:hidden space-y-4">
                    {teamUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No team members found
                      </div>
                    ) : isWebhooksTab ? (
                      <div className="bg-white rounded-lg shadow border border-gray-200">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
                          <h2 className="text-lg font-semibold text-gray-900">Webhook Automation</h2>
                          <p className="text-sm text-gray-600 mt-1">
                            Connect monitoring tools, then configure Slack and Telegram notifications for lifecycle events.
                          </p>
                        </div>
                        <div className="p-4 sm:p-6 space-y-6">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-lg border border-gray-200 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Alert endpoint</p>
                                  <p className="text-sm font-semibold text-gray-900">Create or update incidents</p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                  POST
                                </span>
                              </div>
                              <code className="mt-3 block break-all rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-800">
                                {alertEndpoint}
                              </code>
                              <ul className="mt-3 space-y-1 text-xs text-gray-600">
                                <li>Auth: <span className="font-mono">X-Signature</span> (HMAC SHA256) or <span className="font-mono">X-Webhook-Token</span></li>
                                <li>Body: JSON with <span className="font-mono">service</span>, <span className="font-mono">severity</span>, <span className="font-mono">occurredAt</span>, <span className="font-mono">fingerprint</span></li>
                              </ul>
                            </div>
                            <div className="rounded-lg border border-gray-200 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Recovery endpoint</p>
                                  <p className="text-sm font-semibold text-gray-900">Resolve incidents automatically</p>
                                </div>
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                  POST
                                </span>
                              </div>
                              <code className="mt-3 block break-all rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-800">
                                {recoveryEndpoint}
                              </code>
                              <ul className="mt-3 space-y-1 text-xs text-gray-600">
                                <li>Required: matching <span className="font-mono">fingerprint</span></li>
                                <li>Optional: <span className="font-mono">occurredAt</span>, <span className="font-mono">meta.note</span></li>
                              </ul>
                            </div>
                          </div>

                          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900 space-y-2">
                            <p>
                              Generate <code className="font-mono text-xs">WEBHOOK_HMAC_SECRET</code> once (e.g.
                              <code className="ml-1 font-mono text-xs">openssl rand -hex 32</code>), store it in Render, and share it via your secrets manager.
                              Configure <code className="font-mono text-xs">WEBHOOK_SHARED_TOKEN</code> for trusted scripts and monitor activity via <code className="font-mono text-xs">GET /metrics/webhook</code>.
                            </p>
                          </div>

                          {isAdmin ? (
                            <IntegrationsPanel
                              settings={integrationSettingsQuery.data}
                              isLoading={integrationSettingsQuery.isLoading}
                              isSaving={updateIntegrationSettings.isPending}
                              onSave={handleIntegrationSettingsSave}
                            />
                          ) : (
                            <p className="text-sm text-gray-600">
                              Contact an administrator if you need Slack or Telegram notifications enabled.
                            </p>
                          )}

                          <div className="flex justify-end">
                            <Link
                              href="/docs#webhooks"
                              className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Webhook docs
                              <ChevronRightIcon className="ml-1.5 h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      teamUsers.map((user) => (
                        <div 
                          key={user.id}
                          className={`bg-white border rounded-lg transition-all duration-200 ${
                            expandedUser === user.id 
                              ? 'border-blue-300 shadow-md' 
                              : 'border-gray-200 shadow-sm'
                          }`}
                        >
                          {/* Compact View */}
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => toggleUserExpansion(user.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 font-medium text-sm">
                                      {user.name?.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {user.name}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate">
                                      {user.email}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <ChevronRightIcon 
                                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                                    expandedUser === user.id ? 'rotate-90' : ''
                                  }`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedUser === user.id && (
                            <div className="px-4 pb-4 border-t border-gray-200 pt-4 space-y-4">
                              {editingUser === user.id ? (
                                /* Edit Mode */
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name
                                      </label>
                                      <input
                                        type="text"
                                        value={editFormData.name || ''}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                      </label>
                                      <input
                                        type="email"
                                        value={editFormData.email || ''}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Role
                                      </label>
                                      <select
                                        value={editFormData.role || ''}
                                        onChange={(e) => handleInputChange('role', e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      >
                                        {availableRoles.map(role => (
                                          <option key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Team Roles
                                      </label>
                                      <div className="space-y-2">
                                        {availableTeamRoles.map(role => (
                                          <label key={role} className="flex items-center">
                                            <input
                                              type="checkbox"
                                              checked={(editFormData.teamRoles || []).includes(role)}
                                              onChange={(e) => handleTeamRoleChange(role, e.target.checked)}
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">{role}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={editFormData.isActive || false}
                                          onChange={(e) => handleInputChange('isActive', e.target.checked)}
                                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Active User</span>
                                      </label>
                                    </div>
                                  </div>
                                  
                                  {/* Edit Action Buttons */}
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    <button
                                      onClick={(e) => saveEditing(user.id, e)}
                                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                    >
                                      <CheckIcon className="h-4 w-4 mr-1" />
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      <XIcon className="h-4 w-4 mr-1" />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* View Mode */
                                <>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-500">Role:</span>
                                      <p className="text-gray-900 capitalize mt-1">{user.role}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500">Status:</span>
                                      <div className="mt-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                          user.isActive 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {user.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium text-gray-500 text-sm">Team Roles:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {user.teamRoles.map((role) => (
                                        <span 
                                          key={role}
                                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                                        >
                                          {role}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-500">Last Active:</span>
                                      <p className="text-gray-900 mt-1">
                                        {user.lastActiveAt 
                                          ? new Date(user.lastActiveAt).toLocaleDateString()
                                          : 'Never'
                                        }
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500">Created:</span>
                                      <p className="text-gray-900 mt-1">
                                        {user.createdAt 
                                          ? new Date(user.createdAt).toLocaleDateString()
                                          : 'N/A'
                                        }
                                      </p>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                                    <button
                                      onClick={(e) => startEditing(user, e)}
                                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      <PencilIcon className="h-4 w-4 mr-1" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => handleResetPassword(user.id, e)}
                                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      <KeyIcon className="h-4 w-4 mr-1" />
                                      Reset Password
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteUser(user.id, e)}
                                      disabled={isDeleting === user.id}
                                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                    >
                                      <TrashIcon className="h-4 w-4 mr-1" />
                                      {isDeleting === user.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
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

                  {/* Pagination for Mobile */}
                  {teamUsersMeta && teamUsersMeta.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex-1 flex justify-between items-center">
                        <button
                          onClick={() => setTeamPage(Math.max(1, teamPage - 1))}
                          disabled={teamPage <= 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeftIcon className="h-5 w-5 mr-1" />
                          Previous
                        </button>
                        
                        <div className="hidden sm:flex">
                          <p className="text-sm text-gray-700">
                            Page <span className="font-medium">{teamPage}</span> of{" "}
                            <span className="font-medium">{teamUsersMeta.totalPages}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => setTeamPage(Math.min(teamUsersMeta.totalPages, teamPage + 1))}
                          disabled={teamPage >= teamUsersMeta.totalPages}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                          <ChevronRightIcon className="h-5 w-5 ml-1" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Change Password Tab */
                <div className="p-4 sm:p-6">
                  <div className="max-w-2xl mx-auto">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Update your account password
                      </p>
                    </div>
                    
                    <ChangePasswordCard className="bg-white" />
                  </div>
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
      </div>
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
