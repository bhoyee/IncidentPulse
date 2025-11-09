"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon
} from "@heroicons/react/24/solid";
import { AuthGuard } from "@components/AuthGuard";
import { IncidentDrawer } from "@components/IncidentDrawer";
import { IntegrationsPanel } from "@components/IntegrationsPanel";
import { ServiceManagementPanel } from "@components/ServiceManagementPanel";
import { useSession } from "@hooks/useSession";
import { useIncidents, useInvalidateIncidents } from "@hooks/useIncidents";
import {
  useTeamUsers,
  useCreateTeamUser,
  useUpdateTeamUser,
  useDeleteTeamUser,
  type TeamUser
} from "@hooks/useTeamUsers";
import {
  useIntegrationSettings,
  useUpdateIntegrationSettings,
  type IntegrationSettings
} from "@hooks/useIntegrationSettings";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService
} from "@hooks/useServices";
import { apiClient } from "@lib/api-client";
import type { Incident, IncidentSeverity, IncidentStatus } from "@lib/types";

interface NewTeamMemberPayload {
  name: string;
  email: string;
  role: TeamUser["role"];
  teamRoles: string[];
  sendInvite: boolean;
}

type InviteSummary = {
  name: string;
  email: string;
  password: string | null;
  emailStatus: string | null;
  emailError: string | null;
};

type ServiceOption = {
  id: string;
  name: string;
  slug: string;
};


const PASSWORD_PROMPT_KEY = "incidentpulse.passwordPrompt.dismissed";

const ChangePasswordCard = () => {
  return (
    <form className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-300">Current Password</label>
        <input 
          type="password" 
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" 
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300">New Password</label>
        <input 
          type="password" 
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" 
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300">Confirm New Password</label>
        <input 
          type="password" 
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" 
        />
      </div>
      <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition">
        Update Password
      </button>
    </form>
  );
};

const NewIncidentForm = ({
  disabled,
  onSuccess,
  services
}: {
  disabled: boolean;
  onSuccess: () => void;
  services: ServiceOption[];
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const invalidateIncidents = useInvalidateIncidents();

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    if (!serviceId) {
      setError("Select a service before creating an incident.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post("/incidents", {
        title: title.trim(),
        description: description.trim(),
        severity,
        serviceId
      });
      await invalidateIncidents();
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setServiceId(services[0]?.id ?? "");
      onSuccess();
    } catch (err) {
      let message = "Failed to create incident.";
      if (isAxiosError(err)) {
        message = err.response?.data?.message ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-300">Service</label>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
          disabled={disabled || services.length === 0 || isSubmitting}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        {services.length === 0 ? (
          <p className="mt-1 text-xs text-red-400">
            No services available. Ask an admin to add one on the Automation tab.
          </p>
        ) : null}
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300">Title</label>
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" 
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300">Description</label>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1" 
          rows={3}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300">Severity</label>
        <select 
          value={severity}
          onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || isSubmitting || services.length === 0}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create Incident"}
      </button>
    </form>
  );
};

const AddTeamMemberForm = ({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (payload: NewTeamMemberPayload) => void;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamUser["role"]>("operator");
  const [teamRolesInput, setTeamRolesInput] = useState("Incident Response, On-Call");
  const [sendInvite, setSendInvite] = useState(true);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      return;
    }

    const parsedRoles = teamRolesInput
      .split(",")
      .map((roleItem) => roleItem.trim())
      .filter(Boolean);

    onSubmit({
      name: name.trim(),
      email: email.trim(),
      role,
      teamRoles: parsedRoles.length ? parsedRoles : ["Incident Response"],
      sendInvite,
    });

    setName("");
    setEmail("");
    setRole("operator");
    setTeamRolesInput("Incident Response, On-Call");
    setSendInvite(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-300">
          Full Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Johnson"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={disabled}
            required
          />
        </label>

        <label className="block text-sm font-medium text-gray-300">
          Work Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@yourteam.com"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={disabled}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-300">
          Platform Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamUser["role"])}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={disabled}
          >
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-gray-300">
          Team Roles
          <input
            type="text"
            value={teamRolesInput}
            onChange={(e) => setTeamRolesInput(e.target.value)}
            placeholder="Incident Response, Platform"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={disabled}
          />
          <span className="mt-1 block text-xs text-gray-400">
            Separate multiple roles with commas.
          </span>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
          disabled={disabled}
        />
        <span className="text-sm text-gray-300">
          Email this teammate setup instructions and the incident response playbook.
        </span>
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4" />
        Send Invite
      </button>
    </form>
  );
};

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentIdFromQuery = searchParams.get("incidentId");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>();
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>();
  const [serviceFilter, setServiceFilter] = useState<string | undefined>();
  const [teamSearch, setTeamSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"incidents" | "team" | "profile" | "password" | "webhooks">("incidents");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [inviteSummary, setInviteSummary] = useState<InviteSummary | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "operator" as TeamUser["role"],
    teamRolesInput: "",
    isActive: true
  });
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showPasswordReminder, setShowPasswordReminder] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: session } = useSession();
  const createTeamUser = useCreateTeamUser();
  const updateTeamUser = useUpdateTeamUser();
  const deleteTeamUser = useDeleteTeamUser();
  const servicesQuery = useServices(Boolean(session));
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const isAdmin = session?.role === "admin";
  const canCreate = Boolean(session && session.role !== "viewer");
  const firstName = session?.name?.split(" ")[0] || "Team";
  const integrationSettingsQuery = useIntegrationSettings(Boolean(isAdmin));
  const updateIntegrationSettings = useUpdateIntegrationSettings();
  const isSavingMember = createTeamUser.isPending;
  const isUpdatingMember = updateTeamUser.isPending;
  const serviceRecords = servicesQuery.data ?? [];
  const serviceOptions = serviceRecords.map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug
  }));
  const serviceMutationsPending =
    createService.isPending || updateService.isPending || deleteService.isPending;
  const teamRolesDisplay = session?.teamRoles?.length ? session.teamRoles.join(", ") : "None assigned";
  const roleLabel = session ? session.role.charAt(0).toUpperCase() + session.role.slice(1) : "";
  const alertEndpoint = "https://your-backend.example.com/webhooks/incidents";
  const recoveryEndpoint = "https://your-backend.example.com/webhooks/incidents/recovery";

  const incidentFilters = useMemo(
    () => ({
      status: statusFilter,
      severity: severityFilter,
      serviceId: serviceFilter
    }),
    [statusFilter, severityFilter, serviceFilter]
  );

  useEffect(() => {
    if (!session || typeof window === "undefined") {
      return;
    }
    const dismissed = window.localStorage.getItem(PASSWORD_PROMPT_KEY);
    if (!dismissed) {
      setShowPasswordReminder(true);
    }
  }, [session]);

  const handleSaveIntegrationSettings = async (payload: Partial<IntegrationSettings>) => {
    await updateIntegrationSettings.mutateAsync(payload);
  };

  const handleCreateService = (payload: { name: string; description?: string | null }) =>
    createService.mutateAsync(payload);

  const handleUpdateService = (payload: {
    id: string;
    name?: string;
    description?: string | null;
    slug?: string;
  }) => updateService.mutateAsync(payload);

  const handleDeleteService = (id: string) => deleteService.mutateAsync(id);

  const dismissPasswordReminder = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PASSWORD_PROMPT_KEY, "1");
    }
    setShowPasswordReminder(false);
  };

  const goToChangePassword = () => {
    dismissPasswordReminder();
    setActiveTab("password");
  };

  const handleOpenProfile = () => {
    setShowPasswordReminder(false);
    setActiveTab("profile");
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await apiClient.post("/auth/logout");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PASSWORD_PROMPT_KEY);
      }
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed", error);
      setIsLoggingOut(false);
    }
  };

  const { data: incidentsResponse } = useIncidents(incidentFilters);
  const incidents = incidentsResponse?.data ?? [];

  const teamUsersQuery = useTeamUsers(Boolean(isAdmin), {
    search: teamSearch.trim().length >= 2 ? teamSearch.trim() : undefined,
    page: 1,
    pageSize: 50
  });
  const teamUsers = teamUsersQuery.data?.data ?? [];
  const isTeamLoading = teamUsersQuery.isLoading && teamUsers.length === 0;
  const isTeamRefetching = teamUsersQuery.isFetching && !teamUsersQuery.isLoading;

  useEffect(() => {
    if (incidentIdFromQuery) setSelectedIncidentId(incidentIdFromQuery);
    else setSelectedIncidentId(null);
  }, [incidentIdFromQuery]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">
        Loading workspace...
      </div>
    );
  }

  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
  const activeIncidents = incidents.filter(i => i.status !== 'resolved').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;

  const statMappings = [
    { label: "Active Incidents", value: activeIncidents, colorClass: "bg-yellow-800/30 text-yellow-300", icon: "ACT" },
    { label: "Critical Severity", value: criticalIncidents, colorClass: "bg-red-800/30 text-red-300", icon: "CRIT" },
    { label: "Total Incidents", value: incidents.length, colorClass: "bg-blue-800/30 text-blue-300", icon: "ALL" },
    { label: "Resolved Incidents", value: resolvedIncidents, colorClass: "bg-green-800/30 text-green-300", icon: "DONE" },
  ];

  const handleIncidentSelect = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
    router.replace(`/dashboard?incidentId=${incident.id}`, { scroll: false });
  };

  const handleIncidentDrawerClose = () => {
    setSelectedIncidentId(null);
    router.replace("/dashboard", { scroll: false });
  };

  const navigation = [
    {
      id: "incidents",
      name: "Incidents",
      description: "Live incident feed",
      icon: "INC",
      current: activeTab === "incidents",
      onClick: () => setActiveTab("incidents")
    },
    ...(isAdmin
      ? [
          {
            id: "team",
            name: "Team Management",
            description: "Manage roles & assignments",
            icon: "TEAM",
            current: activeTab === "team",
            onClick: () => setActiveTab("team")
          }
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: "webhooks",
            name: "Automation",
            description: "Webhooks & notifications",
            icon: "AUTO",
            current: activeTab === "webhooks",
            onClick: () => setActiveTab("webhooks")
          }
        ]
      : []),
    {
      id: "profile",
      name: "Profile",
      description: "Your account",
      icon: "USER",
      current: activeTab === "profile",
      onClick: () => setActiveTab("profile")
    },
    {
      id: "password",
      name: "Security",
      description: "Update password",
      icon: "SEC",
      current: activeTab === "password",
      onClick: () => setActiveTab("password")
    }
  ];

  const handleCreateTeamMember = async (payload: NewTeamMemberPayload) => {
    if (!payload.name || !payload.email) {
      return;
    }

    const normalizedRoles = payload.teamRoles.length ? payload.teamRoles : ["Incident Response"];
    setMemberError(null);

    try {
      const response = await createTeamUser.mutateAsync({
        name: payload.name,
        email: payload.email,
        role: payload.role as "admin" | "operator" | "viewer",
        teamRoles: normalizedRoles,
        isActive: true
      });

      setInviteSummary({
        name: response.data.name,
        email: response.data.email,
        password: response.meta?.initialPassword ?? null,
        emailStatus: response.meta?.emailStatus ?? null,
        emailError: response.meta?.emailError ?? null
      });
      setIsAddMemberOpen(false);
    } catch (error) {
      let message = "Failed to create teammate.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setMemberError(message);
    }
  };

  const openEditModal = (user: TeamUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      teamRolesInput: user.teamRoles.join(", "),
      isActive: user.isActive
    });
    setEditError(null);
    setIsEditMemberOpen(true);
  };

  const handleUpdateTeamMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    const parsedRoles = editForm.teamRolesInput
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);

    setEditError(null);

    try {
      await updateTeamUser.mutateAsync({
        id: editingUser.id,
        payload: {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
          teamRoles: parsedRoles,
          isActive: editForm.isActive
        }
      });
      closeEditModal();
    } catch (error) {
      let message = "Failed to update teammate.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setEditError(message);
    }
  };

  const closeEditModal = () => {
    setIsEditMemberOpen(false);
    setEditingUser(null);
    setEditError(null);
  };

  const handleDeleteUser = async (user: TeamUser) => {
    if (deletingUserId) return;
    const confirmed = window.confirm(`Delete ${user.name}'s account? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingUserId(user.id);
    try {
      await deleteTeamUser.mutateAsync(user.id);
    } catch (error) {
      let message = "Failed to delete teammate.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      window.alert(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const filterChips = [
    ...(statusFilter ? [{ label: `Status: ${statusFilter}`, onClear: () => setStatusFilter(undefined) }] : []),
    ...(severityFilter ? [{ label: `Severity: ${severityFilter}`, onClear: () => setSeverityFilter(undefined) }] : []),
    ...(serviceFilter
      ? [{
          label: `Service: ${
            serviceOptions.find((service) => service.id === serviceFilter)?.name ?? "Service"
          }`,
          onClear: () => setServiceFilter(undefined)
        }]
      : [])
  ];

  const filteredIncidents = incidents.filter(incident => {
    if (statusFilter && incident.status !== statusFilter) return false;
    if (severityFilter && incident.severity !== severityFilter) return false;
    if (serviceFilter && incident.serviceId !== serviceFilter) return false;
    return true;
  });

  const filteredTeamUsers = teamUsers.filter(user => 
    user.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
    user.email.toLowerCase().includes(teamSearch.toLowerCase())
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-900 flex font-sans">
        <div className="bg-gray-900 border-r border-gray-700 w-64 hidden lg:flex flex-shrink-0 flex-col pt-6">
          <div className="px-6 mb-8">
            <div className="text-xl font-extrabold tracking-tight text-blue-400">
              Incident<span className="text-gray-50">Pulse</span>
            </div>
          </div>
          <nav className="px-4 space-y-2 flex-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full text-left py-3 px-3 rounded-xl transition duration-200 flex items-center group ${
                  item.current
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className={`mr-3 w-5 h-5 font-bold flex items-center justify-center ${
                  item.current ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'
                }`}>
                  {item.icon}
                </span>
                <div>
                  <span className="text-sm font-semibold block">{item.name}</span>
                  <span className={`text-xs ${item.current ? 'text-blue-200' : 'text-gray-500'}`}>
                    {item.description}
                  </span>
                </div>
              </button>
            ))}
          </nav>
          <div className="px-4 pb-6">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-gray-800 hover:text-white disabled:opacity-60"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-gray-900 border-b border-gray-700 sticky top-0 z-40">
            <div className="px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <div className="flex items-center">
                <button
                  className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-bold text-white ml-4 hidden lg:block">
                  Dashboard / <span className="text-blue-400 capitalize">{activeTab}</span>
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                {canCreate && activeTab === 'incidents' && (
                  <button
                    onClick={() => setIsNewIncidentOpen(true)}
                    className="inline-flex items-center text-sm font-semibold py-2 px-4 rounded-full transition duration-150 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50"
                  >
                    <span className="w-4 h-4 mr-2 font-bold">➕</span>+ New Incident
                  </button>
                )}

                <div className="relative group">
                  <div className="p-2 flex items-center space-x-2 cursor-pointer rounded-full hover:bg-gray-800 transition duration-150">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white uppercase">
                      {firstName.charAt(0)}
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl bg-gray-800 border border-gray-700 hidden group-hover:block z-10">
                    <div className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                      Signed in as <div className="font-medium text-white truncate">{session.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Profile Settings
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-700 disabled:opacity-60"
                    >
                      {isLoggingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="absolute inset-0 bg-black opacity-75"></div>
              <div className="bg-gray-900 border-r border-gray-700 w-64 h-full absolute top-0 left-0 pt-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 mb-8">
                  <div className="text-xl font-extrabold tracking-tight text-blue-400">
                    Incident<span className="text-gray-50">Pulse</span>
                  </div>
                </div>
                <nav className="px-4 space-y-2 flex-1 overflow-y-auto">
                  {navigation.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { item.onClick(); setSidebarOpen(false); }}
                      className={`w-full text-left py-3 px-3 rounded-xl transition duration-200 flex items-center group ${
                        item.current
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span className={`mr-3 w-5 h-5 font-bold flex items-center justify-center ${
                        item.current ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'
                      }`}>
                        {item.icon}
                      </span>
                      <div>
                        <span className="text-sm font-semibold block">{item.name}</span>
                        <span className={`text-xs ${item.current ? 'text-blue-200' : 'text-gray-500'}`}>
                          {item.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </nav>
                <div className="px-4 pt-4 pb-6 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-gray-800 hover:text-white disabled:opacity-60"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    {isLoggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
            {activeTab === 'incidents' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statMappings.map(stat => (
                  <div key={stat.label} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex items-start justify-between shadow-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-400 mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-50">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.colorClass}`}>
                      <span className="text-xl">{stat.icon}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'incidents' && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-700 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Incident Management</h2>
                    <p className="text-sm text-gray-400">Track investigations, assignments, and customer messaging in one centralized view.</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div className="flex min-w-[150px] flex-col">
                      <label className="mb-1 text-xs font-medium text-gray-400">Status</label>
                      <div className="relative">
                        <select
                          onChange={(e) => setStatusFilter(e.target.value as IncidentStatus || undefined)}
                          value={statusFilter || ''}
                          className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-200 shadow-sm transition duration-150 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="open">Open</option>
                          <option value="investigating">Investigating</option>
                          <option value="monitoring">Monitoring</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>

                    <div className="flex min-w-[150px] flex-col">
                      <label className="mb-1 text-xs font-medium text-gray-400">Severity</label>
                      <div className="relative">
                        <select
                          onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity || undefined)}
                          value={severityFilter || ''}
                          className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-200 shadow-sm transition duration-150 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">All Severity</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>

                    <div className="flex min-w-[150px] flex-col">
                      <label className="mb-1 text-xs font-medium text-gray-400">Service</label>
                      <div className="relative">
                        <select
                          onChange={(e) => setServiceFilter(e.target.value || undefined)}
                          value={serviceFilter || ""}
                          className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-gray-200 shadow-sm transition duration-150 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">All Services</option>
                          {serviceOptions.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="rounded-xl border border-blue-500/50 bg-blue-900/40 p-4 text-sm text-blue-300">
                    Automate intake with secure webhooks and send Slack or Telegram alerts from the <strong>Automation</strong> tab.
                  </div>
                )}

                {filterChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                    <span className="text-sm font-semibold text-gray-400">Active Filters:</span>
                    {filterChips.map((chip, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={chip.onClear}
                        className="inline-flex items-center rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30"
                      >
                        {chip.label}
                        <span className="ml-1.5 w-3 h-3 text-blue-300">✕</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <div className="min-w-full inline-block align-middle">
                    <div className="overflow-hidden rounded-xl border border-gray-700 shadow-xl">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-800">
                          <tr>
                            {['Title', 'Service', 'Severity', 'Status', 'Assigned To', 'Created'].map(header => (
                              <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-gray-900 divide-y divide-gray-800">
                          {filteredIncidents.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No incidents matching filters.</td></tr>
                          ) : (
                            filteredIncidents.map(incident => (
                              <tr 
                                key={incident.id} 
                                onClick={() => handleIncidentSelect(incident)} 
                                className="hover:bg-gray-800/70 cursor-pointer transition duration-150"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                  {incident.title}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {incident.service?.name ?? "—"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium uppercase border ${
                                    incident.severity === 'critical' ? 'bg-red-800/50 text-red-300 border-red-500' :
                                    incident.severity === 'high' ? 'bg-orange-800/50 text-orange-300 border-orange-500' :
                                    incident.severity === 'medium' ? 'bg-yellow-800/50 text-yellow-300 border-yellow-500' :
                                    'bg-green-800/50 text-green-300 border-green-500'
                                  }`}>
                                    {incident.severity}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`capitalize font-semibold ${
                                    incident.status === 'open' || incident.status === 'investigating' ? 'text-red-400' :
                                    incident.status === 'monitoring' ? 'text-yellow-400' : 'text-green-400'
                                  }`}>
                                    {incident.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {incident.assignedTo?.name ?? 'Unassigned'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(incident.createdAt).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 shadow-lg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-700 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Team Management</h2>
                    <p className="text-sm text-gray-400">Invite responders, manage roles, and keep audit trails clean.</p>
                  </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                        placeholder="Search team members..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[220px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMemberError(null);
                          setIsAddMemberOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500 bg-blue-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Team Member
                      </button>
                      {isTeamRefetching ? (
                        <p className="text-xs text-gray-500">Syncing roster…</p>
                      ) : null}
                    </div>
                  </div>

                {inviteSummary && (
                  <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-900/30 p-4 text-sm text-blue-100">
                    <p className="text-base font-semibold text-white">
                      {inviteSummary.name} was invited successfully.
                    </p>
                    <p className="mt-1">
                      Email: <span className="font-mono text-blue-200">{inviteSummary.email}</span>
                    </p>
                    {inviteSummary.password ? (
                      <p className="mt-1">
                        Temporary password:{" "}
                        <code className="rounded bg-blue-800/60 px-2 py-0.5 text-blue-100">
                          {inviteSummary.password}
                        </code>
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-blue-300">
                      Email status:{" "}
                      <span className="font-semibold text-white">
                        {inviteSummary.emailStatus ?? "queued"}
                      </span>
                      {inviteSummary.emailError ? (
                        <span className="ml-2 text-red-200">
                          ({inviteSummary.emailError})
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-xl">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-800">
                        <tr>
                          {['Name', 'Email', 'Role', 'Team Roles', 'Status', 'Last Active', 'Actions'].map(header => (
                            <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-gray-900 divide-y divide-gray-800">
                        {isTeamLoading ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                              Loading team directory...
                            </td>
                          </tr>
                        ) : filteredTeamUsers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                              No team members found.
                            </td>
                          </tr>
                        ) : (
                          filteredTeamUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-800/70 transition duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{user.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{user.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 capitalize">
                                {user.role}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex flex-wrap gap-1">
                                  {user.teamRoles.map(role => (
                                    <span key={role} className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${
                                  user.isActive ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
                                }`}>
                                  {user.isActive ? 'Active' : 'Suspended'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) : 'Never'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex flex-wrap gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(user)}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 px-3 py-1 text-xs font-semibold text-blue-300 transition hover:border-blue-400 hover:text-white"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingUserId === user.id}
                                    onClick={() => handleDeleteUser(user)}
                                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                    {deletingUserId === user.id ? "Removing..." : "Delete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webhooks' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-8 shadow-lg">
                <div className="rounded-xl border border-blue-500/50 bg-blue-900/40 p-6 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-blue-300">Automation</p>
                      <h2 className="text-2xl font-bold text-white">Webhooks & Integrations</h2>
                      <p className="text-sm text-blue-300">
                        Create or resolve incidents from monitoring tools and broadcast lifecycle updates to services.
                      </p>
                    </div>
                    <Link
                      href="/docs#webhooks"
                      className="inline-flex items-center text-sm font-semibold text-blue-300 hover:text-white transition duration-200"
                    >
                      Open Documentation
                      <span className="ml-1.5 h-4 w-4 font-bold">↗</span>
                    </Link>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2 pt-4 border-t border-blue-700/50">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-2">Alert Endpoint</p>
                      <code className="mt-2 block break-all rounded-lg border border-blue-700 bg-gray-900 px-4 py-3 font-mono text-xs text-green-400 shadow-inner">
                        {alertEndpoint}
                      </code>
                      <p className="mt-2 text-xs text-blue-400">
                        Use this endpoint to <strong>create or update</strong> incidents from your monitoring systems.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-blue-400 mb-2">Recovery Endpoint</p>
                      <code className="mt-2 block break-all rounded-lg border border-blue-700 bg-gray-900 px-4 py-3 font-mono text-xs text-green-400 shadow-inner">
                        {recoveryEndpoint}
                      </code>
                      <p className="mt-2 text-xs text-blue-400">
                        Send the matching <code className="font-mono text-white">fingerprint</code> to <strong>resolve</strong> incidents automatically.
                      </p>
                    </div>
                  </div>
                </div>

                <ServiceManagementPanel
                  services={servicesQuery.data}
                  isLoading={servicesQuery.isLoading}
                  onCreate={handleCreateService}
                  onUpdate={handleUpdateService}
                  onDelete={handleDeleteService}
                  isMutating={serviceMutationsPending}
                />

                <div className="rounded-xl border border-gray-700 bg-gray-900 shadow-inner">
                  <IntegrationsPanel
                    settings={integrationSettingsQuery.data}
                    isLoading={integrationSettingsQuery.isLoading}
                    onSave={handleSaveIntegrationSettings}
                    isSaving={updateIntegrationSettings.isPending}
                  />
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-3xl mx-auto p-6 lg:p-8 space-y-6 shadow-lg">
                <h2 className="text-2xl font-bold text-white">Profile</h2>
                <p className="text-sm text-gray-400">
                  View your account details. Contact an administrator if something looks incorrect.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Full name</p>
                    <p className="mt-1 text-sm font-semibold text-white">{session?.name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
                    <p className="mt-1 text-sm font-semibold text-white">{session?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Role</p>
                    <p className="mt-1 text-sm font-semibold text-white">{roleLabel}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Team roles</p>
                    <p className="mt-1 text-sm font-semibold text-white">{teamRolesDisplay}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-lg mx-auto p-6 lg:p-8 space-y-6 shadow-lg">
                <h2 className="text-2xl font-bold text-white">Update Password</h2>
                <p className="text-sm text-gray-400">
                  Ensure your account is secure by regularly updating your password.
                </p>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-lg">
                  <h3 className="text-xl font-semibold text-white">Change Password</h3>
                  <ChangePasswordCard />
                </div>
              </div>
            )}
          </main>
        </div>

        {showPasswordReminder && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-semibold text-slate-900">Secure your account</h3>
              <p className="mt-2 text-sm text-slate-600">
                This looks like your first visit. Update your password now to keep your workspace
                safe.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={dismissPasswordReminder}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={goToChangePassword}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Change password
                </button>
              </div>
            </div>
          </div>
        )}

        <IncidentDrawer
          incidentId={selectedIncidentId ?? undefined}
          open={Boolean(selectedIncidentId)}
          onClose={handleIncidentDrawerClose}
          currentUser={{
            id: session.id,
            role: session.role
          }}
          teamUsers={teamUsers}
          services={serviceRecords}
        />

        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Invite a New Team Member</h3>
                  <p className="text-sm text-gray-400">
                    Create secure operator accounts without leaving the console.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMemberError(null);
                    setIsAddMemberOpen(false);
                  }}
                  className="text-gray-400 transition hover:text-white"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-6">
                {memberError ? (
                  <div className="mb-4 rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                    {memberError}
                  </div>
                ) : null}
                <AddTeamMemberForm
                  disabled={isSavingMember}
                  onSubmit={handleCreateTeamMember}
                />
                {isSavingMember && (
                  <p className="mt-4 text-center text-sm text-gray-400">
                    Provisioning access&hellip;
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isEditMemberOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Update {editingUser.name}</h3>
                  <p className="text-sm text-gray-400">
                    Adjust permissions or status instantly.
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 transition hover:text-white"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateTeamMember} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Full Name
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-300">
                    Work Email
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Platform Role
                    <select
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          role: e.target.value as TeamUser["role"]
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-gray-300">
                    Team Roles
                    <input
                      type="text"
                      value={editForm.teamRolesInput}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, teamRolesInput: e.target.value }))
                      }
                      placeholder="Incident Response, Platform"
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="mt-1 block text-xs text-gray-400">
                      Separate multiple roles with commas.
                    </span>
                  </label>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-200">
                      Active account
                    </span>
                    <p className="text-xs text-gray-400">
                      Uncheck to immediately suspend access.
                    </p>
                  </div>
                </label>

                {editError ? (
                  <p className="text-sm text-red-400">{editError}</p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingMember}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingMember ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isNewIncidentOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Create New Incident</h3>
                <button 
                  onClick={() => setIsNewIncidentOpen(false)} 
                  className="text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <NewIncidentForm
                disabled={!canCreate}
                onSuccess={() => setIsNewIncidentOpen(false)}
                services={serviceOptions}
              />
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full border-4 border-gray-700 border-t-blue-600 animate-spin mr-3" />
          <span className="text-base text-gray-400 font-medium">Loading dashboard...</span>
        </div>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}

