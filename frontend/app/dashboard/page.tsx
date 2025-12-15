"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { format } from "date-fns";
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
  ArrowRightOnRectangleIcon,
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ServerStackIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CpuChipIcon,
  CreditCardIcon,
  LifebuoyIcon,
  KeyIcon
} from "@heroicons/react/24/solid";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar
} from "recharts";
import { AuthGuard } from "@components/AuthGuard";
import { IncidentDrawer } from "@components/IncidentDrawer";
import { IntegrationsPanel } from "@components/IntegrationsPanel";
import { ServiceManagementPanel } from "@components/ServiceManagementPanel";
import { Pagination } from "@components/Pagination";
import { useSession, type SessionUser } from "@hooks/useSession";
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
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  type ApiKey
} from "@hooks/useApiKeys";
import {
  useMaintenanceEvents,
  useCreateMaintenanceEvent,
  useCancelMaintenanceEvent
} from "@hooks/useMaintenance";
import { useAnalytics } from "@hooks/useAnalytics";
import { useAuditLogs } from "@hooks/useAuditLogs";
import {
  useOrgSupportTickets,
  useCreateSupportTicket,
  useAddSupportComment,
  usePlatformSupportTickets,
  useUpdateSupportStatus,
  useAssignSupportTicket,
  useUploadSupportAttachments,
  type SupportTicket
} from "@hooks/useSupport";
import {
  useOrganizations,
  useSwitchOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  type Organization
} from "@hooks/useOrganizations";
import { usePlatformOrgs, usePlatformUsers } from "@hooks/usePlatform";
import { ChangePasswordCard } from "@components/ChangePasswordCard";
import { FirstStepsModal } from "@components/FirstStepsModal";
import { useIncidentStream } from "@hooks/useIncidentStream";
import { useOpenBillingPortal, useStartCheckout, useInvoices } from "@hooks/useBilling";
import { apiClient } from "@lib/api-client";
import {
  MAX_ATTACHMENTS_PER_BATCH,
  MAX_ATTACHMENT_BYTES,
  formatAttachmentSize,
  uploadIncidentAttachment,
  validateAttachmentSize
} from "@lib/attachments";
import type { Incident, IncidentSeverity, IncidentStatus, MaintenanceEvent } from "@lib/types";

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


const FIRST_STEPS_KEY = "incidentpulse.firstSteps.dismissed";
const PASSWORD_PROMPT_KEY = "incidentpulse.passwordPrompt.dismissed";
// Namespace the password reminder per-email so shared browsers don't bleed state.
const getPasswordPromptKey = (email?: string | null) =>
  `${PASSWORD_PROMPT_KEY}:${email?.toLowerCase() ?? "anonymous"}`;

function StatCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-inner">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-inner">
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 text-sm text-gray-400">
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 text-sm text-gray-400">
      {message}
    </div>
  );
}

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    user_login: "User login",
    user_created: "User created",
    user_updated: "User updated",
    user_deleted: "User deleted",
    incident_created: "Incident created",
    incident_updated: "Incident updated",
    incident_resolved: "Incident resolved",
    incident_investigating: "Incident investigating",
    incident_monitoring: "Incident monitoring",
    incident_deleted: "Incident deleted",
    maintenance_created: "Maintenance created",
    maintenance_updated: "Maintenance updated",
    maintenance_canceled: "Maintenance canceled"
  };
  return map[action] ?? action;
}

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
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const invalidateIncidents = useInvalidateIncidents();
  const attachmentLimit = MAX_ATTACHMENTS_PER_BATCH;
  const attachmentSizeLimitMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const handleEvidenceSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    let message: string | null = null;
    const accepted: File[] = [];

    for (const file of files) {
      const validationError = validateAttachmentSize(file);
      if (validationError) {
        message = validationError;
        break;
      }
      accepted.push(file);
    }

    const combined = [...evidenceFiles, ...accepted];
    if (!message && combined.length > attachmentLimit) {
      message = `You can attach up to ${attachmentLimit} files per incident.`;
    }

    if (message) {
      setAttachmentError(message);
    } else {
      setAttachmentError(null);
      setEvidenceFiles(combined.slice(0, attachmentLimit));
    }

    event.target.value = "";
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

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
    setAttachmentError(null);
    setIsSubmitting(true);

    let attachmentWarning: string | null = null;

    try {
      const response = await apiClient.post<{ error: boolean; data: Incident }>("/incidents", {
        title: title.trim(),
        description: description.trim(),
        severity,
        serviceId
      });
      const createdIncident = response.data.data;

      if (createdIncident?.id && evidenceFiles.length > 0) {
        setIsUploadingEvidence(true);
        try {
          for (const file of evidenceFiles) {
            await uploadIncidentAttachment(createdIncident.id, file);
          }
          setEvidenceFiles([]);
        } catch (uploadError) {
          attachmentWarning =
            "Incident created, but one or more attachments failed to upload. Open the incident detail to add evidence from the timeline.";
          if (isAxiosError(uploadError)) {
            attachmentWarning = uploadError.response?.data?.message ?? attachmentWarning;
          } else if (uploadError instanceof Error) {
            attachmentWarning = uploadError.message;
          }
          setAttachmentError(attachmentWarning);
        } finally {
          setIsUploadingEvidence(false);
        }
      } else {
        setEvidenceFiles([]);
      }

      await invalidateIncidents();
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setServiceId(services[0]?.id ?? "");
      if (!attachmentWarning) {
        setAttachmentError(null);
      }
      onSuccess();
      if (attachmentWarning) {
        window.alert(attachmentWarning);
      }
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
      setIsUploadingEvidence(false);
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
            No services available. Ask an admin to add one on the Services tab.
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
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-100">Evidence (optional)</p>
            <p className="text-xs text-gray-400">
              Up to {attachmentLimit} files · {attachmentSizeLimitMb}MB each. Accepted types follow admin defaults.
            </p>
          </div>
          <label
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-gray-400 hover:text-white"
          >
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={handleEvidenceSelect}
              disabled={isSubmitting || isUploadingEvidence || disabled}
            />
            {isUploadingEvidence ? "Uploading…" : "Upload files"}
          </label>
        </div>
        {attachmentError ? (
          <p className="mt-2 text-xs text-red-400">{attachmentError}</p>
        ) : null}
        {evidenceFiles.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-gray-100">
            {evidenceFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center justify-between rounded-md bg-gray-900/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatAttachmentSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEvidence(index)}
                  className="text-xs text-red-400 hover:text-red-300"
                  disabled={isSubmitting || isUploadingEvidence}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || isSubmitting || isUploadingEvidence || services.length === 0}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
      >
        {isSubmitting || isUploadingEvidence ? "Creating..." : "Create Incident"}
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

const slugifyName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

function OrganizationsPanel({ session }: { session?: SessionUser | null }) {
  const { data: organizations = [], isLoading, isFetching } = useOrganizations();
  const switchOrg = useSwitchOrganization();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyName(name));
    }
  }, [name, slugTouched]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setEditingId(null);
    setSlugTouched(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !slug.trim()) {
      setFormError("Name and slug are required.");
      return;
    }
    try {
      if (editingId) {
        await updateOrg.mutateAsync({ id: editingId, name: name.trim(), slug: slug.trim() });
      } else {
        await createOrg.mutateAsync({ name: name.trim(), slug: slug.trim() });
      }
      resetForm();
    } catch (error) {
      if (isAxiosError(error)) {
        setFormError(error.response?.data?.message ?? "Unable to save organization.");
      } else {
        setFormError("Unable to save organization.");
      }
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingId(org.id);
    setName(org.name);
    setSlug(org.slug);
    setSlugTouched(true);
    setFormError(null);
  };

  const handleDelete = async (orgId: string) => {
    setFormError(null);
    if (deleteConfirmId !== orgId) {
      setDeleteConfirmId(orgId);
      return;
    }
    try {
      await deleteOrg.mutateAsync(orgId);
      if (orgId === session?.orgId) {
        const fallback = organizations.find((o) => o.id !== orgId);
        if (fallback) {
          await switchOrg.mutateAsync(fallback.id);
        }
      }
      resetForm();
    } catch (error) {
      if (isAxiosError(error)) {
        setFormError(error.response?.data?.message ?? "Unable to delete organization.");
      } else {
        setFormError("Unable to delete organization.");
      }
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSwitch = async (orgId: string) => {
    setFormError(null);
    try {
      await switchOrg.mutateAsync(orgId);
    } catch (error) {
      if (isAxiosError(error)) {
        setFormError(error.response?.data?.message ?? "Unable to switch organization.");
      } else {
        setFormError("Unable to switch organization.");
      }
    }
  };

  const isSaving = createOrg.isPending || updateOrg.isPending;
  const isDeleting = deleteOrg.isPending;
  const isSwitching = switchOrg.isPending;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 lg:p-8 shadow-lg">
      <div className="flex flex-col gap-4 border-b border-gray-700 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Organizations</h2>
          <p className="text-sm text-gray-400">
            Create new workspaces, rename them, switch contexts, or clean up old ones.
          </p>
        </div>
      </div>

      {formError ? (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-900/40 px-4 py-3 text-sm text-red-100">
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="text-sm font-semibold text-gray-200">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Acme Corp"
          />
        </div>
        <div className="lg:col-span-1">
          <label className="text-sm font-semibold text-gray-200">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="acme-corp"
          />
        </div>
        <div className="lg:col-span-1 flex items-end gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : editingId ? "Update Organization" : "Create Organization"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-200 hover:border-gray-500 hover:text-white"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-8">
        {isLoading ? (
          <LoadingState message="Loading organizations..." />
        ) : organizations.length === 0 ? (
          <EmptyState message="No organizations yet. Create your first workspace above." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-xl">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  {["Name", "Plan", "Members", "Services", "Role", "Status", "Actions"].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900">
                {organizations.map((org) => {
                  const isCurrent = org.id === session?.orgId;
                  return (
                    <tr key={org.id} className="hover:bg-gray-800/70 transition">
                      <td className="px-4 py-3 text-sm text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{org.name}</span>
                          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300">
                            {org.slug}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full bg-green-800/60 px-2 py-0.5 text-[11px] font-semibold text-green-200">
                              Current
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-200">{org.plan ?? "free"}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{org.membersCount ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{org.servicesCount ?? 0}</td>
                      <td className="px-4 py-3 text-sm capitalize text-blue-200">{org.membershipRole}</td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-300">
                        {org.status ?? "active"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isCurrent || isSwitching}
                            onClick={() => handleSwitch(org.id)}
                            className="rounded-md border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCurrent ? "Active" : isSwitching ? "Switching..." : "Switch"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(org)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 px-3 py-1 text-xs font-semibold text-blue-300 transition hover:border-blue-400 hover:text-white"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDelete(org.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <TrashIcon className="h-4 w-4" />
                            {deleteConfirmId === org.id ? "Confirm" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isFetching ? (
          <p className="mt-2 text-xs text-gray-500">Syncing organizations...</p>
        ) : null}
      </div>
    </div>
  );
}

function SupportPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: supportResponse, isLoading } = useOrgSupportTickets({
    status: statusFilter || undefined,
    q: search || undefined,
    page,
    pageSize
  });
  const tickets = supportResponse?.data ?? [];
  const totalTickets = supportResponse?.meta?.total ?? tickets.length;
  const createTicket = useCreateSupportTicket();
  const addComment = useAddSupportComment("org");
  const uploadAttachments = useUploadSupportAttachments("org");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [category, setCategory] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [creationFiles, setCreationFiles] = useState<File[]>([]);
  const [creationAttachmentError, setCreationAttachmentError] = useState<string | null>(null);

  const statusClasses = (status: SupportTicket["status"]) => {
    switch (status) {
      case "closed":
        return "bg-emerald-900/50 text-emerald-200 border border-emerald-500/40";
      case "pending":
        return "bg-amber-900/40 text-amber-200 border border-amber-500/40";
      default:
        return "bg-blue-900/40 text-blue-200 border border-blue-500/40";
    }
  };

  const priorityClasses = (p: SupportTicket["priority"]) => {
    switch (p) {
      case "urgent":
        return "bg-red-900/50 text-red-200 border border-red-500/50";
      case "high":
        return "bg-amber-900/50 text-amber-100 border border-amber-500/50";
      case "low":
        return "bg-slate-800 text-slate-200 border border-slate-600";
      default:
        return "bg-blue-900/40 text-blue-100 border border-blue-500/40";
    }
  };

  const handleCreationFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;

    let message: string | null = null;
    const accepted: File[] = [];
    for (const file of files) {
      const validation = validateAttachmentSize(file);
      if (validation) {
        message = validation;
        break;
      }
      accepted.push(file);
    }
    const combined = [...creationFiles, ...accepted];
    if (!message && combined.length > MAX_ATTACHMENTS_PER_BATCH) {
      message = `You can attach up to ${MAX_ATTACHMENTS_PER_BATCH} files.`;
    }

    if (message) {
      setCreationAttachmentError(message);
    } else {
      setCreationAttachmentError(null);
      setCreationFiles(combined.slice(0, MAX_ATTACHMENTS_PER_BATCH));
    }

    event.target.value = "";
  };

  const handleRemoveCreationFile = (idx: number) => {
    setCreationFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setFormError("Subject and details are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const ticket = await createTicket.mutateAsync({
        subject: subject.trim(),
        body: body.trim(),
        priority,
        category: category.trim() || undefined
      });
      if (creationFiles.length) {
        await uploadAttachments.mutateAsync({ ticketId: ticket.id, files: creationFiles });
      }
      setSubject("");
      setBody("");
      setCategory("");
      setPriority("medium");
      setCreationFiles([]);
      setCreationAttachmentError(null);
      setFormError(null);
      setPage(1);
    } catch (error) {
      let message = "Failed to create ticket.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComment = async (ticketId: string) => {
    const text = commentInputs[ticketId]?.trim();
    if (!text) return;
    setCommentSubmitting(ticketId);
    try {
      await addComment.mutateAsync({ ticketId, body: text });
      setCommentInputs((prev) => ({ ...prev, [ticketId]: "" }));
    } catch (error) {
      let message = "Failed to add comment.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      window.alert(message);
    } finally {
      setCommentSubmitting(null);
    }
  };

  const handleAttachments = async (ticketId: string, fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    setUploadingFor(ticketId);
    try {
      await uploadAttachments.mutateAsync({ ticketId, files });
    } catch (error) {
      let message = "Failed to upload attachments.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      window.alert(message);
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-8 shadow-lg">
      <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
        <p className="text-xs uppercase tracking-wide text-blue-300">Support</p>
        <h2 className="text-2xl font-bold text-white">Support tickets</h2>
        <p className="text-sm text-gray-300">
          Create support tickets, add comments, and attach evidence. Attachments open in a new tab.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-300">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Example: Cannot send incident webhooks"
              required
            />
          </label>
          <label className="text-sm text-gray-300">
            Category (optional)
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Integrations, Billing, Access"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-300">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="text-sm text-gray-300">
            Attach files (optional)
            <input
              type="file"
              multiple
              onChange={handleCreationFileSelect}
              className="mt-1 block w-full text-xs text-gray-200"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Up to {MAX_ATTACHMENTS_PER_BATCH} files, {Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB each.
            </span>
            {creationFiles.length ? (
              <div className="mt-2 space-y-1 rounded border border-gray-700 bg-gray-900/80 p-2">
                {creationFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between text-xs text-gray-200">
                    <span className="truncate">{file.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{formatAttachmentSize(file.size)}</span>
                      <button
                        type="button"
                        className="text-amber-300 hover:text-amber-100"
                        onClick={() => handleRemoveCreationFile(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {creationAttachmentError ? (
              <span className="block text-xs text-red-400">{creationAttachmentError}</span>
            ) : null}
          </label>
        </div>
        <label className="text-sm text-gray-300">
          Details
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Describe the issue, steps to reproduce, and expected behavior."
            required
          />
        </label>
        {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit ticket"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Your tickets</h3>
            <span className="text-xs text-gray-400">{totalTickets} total</span>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search subject or details"
              className="w-full md:w-64 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 10;
                setPageSize(next);
                setPage(1);
              }}
              className="w-full md:w-40 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <LoadingState message="Loading tickets..." />
        ) : tickets.length === 0 ? (
          <EmptyState message="No support tickets yet. Create one above." />
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 space-y-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(ticket.status)}`}>
                        {ticket.status.toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityClasses(ticket.priority)}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                      {ticket.category ? (
                        <span className="rounded-full border border-gray-600 px-2 py-1 text-xs text-gray-200">
                          {ticket.category}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="text-lg font-semibold text-white">{ticket.subject}</h4>
                    <p className="text-xs text-gray-400">
                      Opened {format(new Date(ticket.createdAt), "PP p")} by{" "}
                      {ticket.createdBy?.name || "Unknown"}
                    </p>
                  </div>
                  <div className="text-sm text-gray-300">
                    Assignee:{" "}
                    <span className="font-semibold">
                      {ticket.assignee?.name || "Unassigned"}
                    </span>
                  </div>
                </div>

                <p className="whitespace-pre-wrap text-sm text-gray-200">{ticket.body}</p>

                {ticket.attachments && ticket.attachments.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-300">Attachments</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {ticket.attachments.map((att) => {
                        const href = att.path?.startsWith("http")
                          ? att.path
                          : `/uploads/${att.path}`;
                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between rounded border border-gray-700 bg-gray-950 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white">{att.filename}</p>
                              <p className="text-xs text-gray-400">
                                {formatAttachmentSize(att.size ?? 0)}
                              </p>
                            </div>
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-blue-400 hover:text-blue-200"
                            >
                              View
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-300">Comments</p>
                  <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/80 p-3">
                    {ticket.comments && ticket.comments.length > 0 ? (
                      ticket.comments.map((comment) => (
                        <div key={comment.id} className="rounded border border-gray-800 bg-gray-900/80 p-2">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{comment.author?.name || "Unknown"}</span>
                            <span>{format(new Date(comment.createdAt), "PP p")}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">No comments yet.</p>
                    )}
                    <div className="space-y-2">
                      <textarea
                        value={commentInputs[ticket.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        rows={2}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Add a reply"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="text-xs text-gray-300">
                          Attach files
                          <input
                            type="file"
                            multiple
                            onChange={(e) => {
                              handleAttachments(ticket.id, e.target.files);
                              e.target.value = "";
                            }}
                            className="mt-1 block w-full text-xs text-gray-200"
                            disabled={uploadingFor === ticket.id}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleComment(ticket.id)}
                          disabled={commentSubmitting === ticket.id}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {commentSubmitting === ticket.id ? "Sending…" : "Post reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {totalTickets > pageSize ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={totalTickets}
                onPageChange={(p) => setPage(p)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformSupportPanel({
  orgs,
  users
}: {
  orgs: Array<{ id: string; name: string; slug?: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data: tickets = [], isLoading } = usePlatformSupportTickets(true, {
    status: statusFilter || undefined,
    orgId: orgFilter || undefined
  });
  const updateStatus = useUpdateSupportStatus("platform");
  const assignTicket = useAssignSupportTicket();
  const addComment = useAddSupportComment("platform");

  const handleAssign = async (ticketId: string, assigneeId: string) => {
    await assignTicket.mutateAsync({ ticketId, assigneeId });
  };

  const handleStatus = async (ticketId: string, status: "open" | "pending" | "closed") => {
    await updateStatus.mutateAsync({ ticketId, status });
  };

  const handleAddNote = async (ticketId: string) => {
    const body = (notes[ticketId] ?? "").trim();
    if (!body) return;
    await addComment.mutateAsync({ ticketId, body, isInternal: true });
    setNotes((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="text-xs font-semibold uppercase text-gray-400">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-400 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-gray-400">
          Organization
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-400 focus:ring-blue-500"
          >
            <option value="">All orgs</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900 shadow-lg">
        <table className="min-w-full divide-y divide-gray-800 text-sm">
          <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Org</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Assignee</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Internal note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Loading tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No tickets found.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-800/60">
                  <td className="px-4 py-3 font-semibold text-white">{ticket.subject}</td>
                  <td className="px-4 py-3 text-gray-300">{ticket.organization?.name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-gray-200">{ticket.priority}</td>
                  <td className="px-4 py-3">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatus(ticket.id, e.target.value as any)}
                      className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-400 focus:ring-blue-500"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={ticket.assignee?.id ?? ""}
                      onChange={(e) => handleAssign(ticket.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-400 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {format(new Date(ticket.createdAt), "PP p")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={notes[ticket.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                        placeholder="Add internal note"
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-400 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNote(ticket.id)}
                        className="self-start rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        Save note
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
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentIdFromQuery = searchParams.get("incidentId");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>();
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>();
  const [serviceFilter, setServiceFilter] = useState<string | undefined>();
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPage, setTeamPage] = useState(1);
  const TEAM_PAGE_SIZE = 10;
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 20;
  const [isSimulatingIncident, setIsSimulatingIncident] = useState(false);
  const [platformTicketStatus, setPlatformTicketStatus] = useState<string>("");
  const [platformTicketOrg, setPlatformTicketOrg] = useState<string>("");
  const auditActionOptions = [
    { value: "", label: "All actions" },
    { value: "user_login", label: "User login" },
    { value: "user_created", label: "User created" },
    { value: "user_updated", label: "User updated" },
    { value: "user_deleted", label: "User deleted" },
    { value: "incident_created", label: "Incident created" },
    { value: "incident_updated", label: "Incident updated" },
    { value: "incident_resolved", label: "Incident resolved" },
    { value: "incident_investigating", label: "Incident investigating" },
    { value: "incident_monitoring", label: "Incident monitoring" },
    { value: "incident_deleted", label: "Incident deleted" },
    { value: "maintenance_created", label: "Maintenance created" },
    { value: "maintenance_updated", label: "Maintenance updated" },
    { value: "maintenance_canceled", label: "Maintenance canceled" }
  ];
  const [activeTab, setActiveTab] = useState<
    | "incidents"
    | "team"
    | "organizations"
    | "services"
    | "maintenance"
    | "audit"
    | "analytics"
    | "webhooks"
    | "billing"
    | "support"
    | "apiKeys"
    | "profile"
    | "password"
    | "platformOps"
    | "platformSupport"
    | "platformBilling"
  >("incidents");
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
  const [showFirstSteps, setShowFirstSteps] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: "",
    description: "",
    start: "",
    end: "",
    appliesToAll: true,
    serviceId: ""
  });
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);

  const { data: session } = useSession();
  useIncidentStream(Boolean(session));
  const isAdmin = session?.role === "admin";
  const createTeamUser = useCreateTeamUser();
  const updateTeamUser = useUpdateTeamUser();
  const deleteTeamUser = useDeleteTeamUser();
  const servicesQuery = useServices(Boolean(session));
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const maintenanceEventsQuery = useMaintenanceEvents("upcoming", { enabled: Boolean(isAdmin) });
  const maintenanceEvents = maintenanceEventsQuery.data ?? [];
  const createMaintenanceEvent = useCreateMaintenanceEvent();
  const cancelMaintenanceEvent = useCancelMaintenanceEvent();
  const analyticsQuery = useAnalytics();
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
  const openPortal = useOpenBillingPortal();
  const startCheckout = useStartCheckout();
  const [checkoutPlanLoading, setCheckoutPlanLoading] = useState<"pro" | "enterprise" | null>(null);
  const invoicesQuery = useInvoices(isAdmin && activeTab === "billing");
  const apiKeysQuery = useApiKeys(Boolean(isAdmin));
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const incidentFilters = useMemo(
    () => ({
      status: statusFilter,
      severity: severityFilter,
      serviceId: serviceFilter
    }),
    [statusFilter, severityFilter, serviceFilter]
  );

  useEffect(() => {
    setIncidentPage(1);
  }, [statusFilter, severityFilter, serviceFilter]);

  useEffect(() => {
    setTeamPage(1);
  }, [teamSearch]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditSearch]);

  // Show the “secure your account” reminder once per user (and never for demo logins).
  useEffect(() => {
    if (!session || session.isDemo || typeof window === "undefined") {
      return;
    }
    const key = getPasswordPromptKey(session.email);
    const dismissed = window.localStorage.getItem(key);
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

  const handleMaintenanceFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = event.target;
    const { name } = target;
    setMaintenanceForm((prev) => {
      if (name === "appliesToAll" && target instanceof HTMLInputElement) {
        const checked = target.checked;
        return {
          ...prev,
          appliesToAll: checked,
          serviceId: checked ? "" : prev.serviceId
        };
      }
      return {
        ...prev,
        [name]:
          target instanceof HTMLInputElement && target.type === "checkbox"
            ? target.checked
            : target.value
      };
    });
  };

  const handleMaintenanceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!maintenanceForm.title.trim()) {
      setMaintenanceError("Title is required.");
      return;
    }
    if (!maintenanceForm.start || !maintenanceForm.end) {
      setMaintenanceError("Start and end times are required.");
      return;
    }
    const startsAt = new Date(maintenanceForm.start);
    const endsAt = new Date(maintenanceForm.end);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setMaintenanceError("Enter valid dates.");
      return;
    }
    if (startsAt >= endsAt) {
      setMaintenanceError("End time must be after the start.");
      return;
    }
    const selectedService = serviceOptions.find(
      (service) => service.id === maintenanceForm.serviceId
    );

    if (!maintenanceForm.appliesToAll && !selectedService) {
      setMaintenanceError("Select a service or mark the window as global.");
      return;
    }

    try {
      setMaintenanceError(null);
      await createMaintenanceEvent.mutateAsync({
        title: maintenanceForm.title.trim(),
        description: maintenanceForm.description?.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        appliesToAll: maintenanceForm.appliesToAll,
        serviceId: maintenanceForm.appliesToAll ? null : selectedService?.id ?? null
      });

      setMaintenanceForm({
        title: "",
        description: "",
        start: "",
        end: "",
        appliesToAll: true,
        serviceId: ""
      });
    } catch (error) {
      if (error instanceof Error) {
        setMaintenanceError(error.message);
      } else {
        setMaintenanceError("Failed to schedule maintenance. Please try again.");
      }
    }
  };

  const handleCancelMaintenance = async (id: string) => {
    try {
      await cancelMaintenanceEvent.mutateAsync(id);
    } catch (error) {
      if (error instanceof Error) {
        setMaintenanceError(error.message);
      } else {
        setMaintenanceError("Unable to cancel maintenance. Please retry.");
      }
    }
  };

  const handleOpenFirstSteps = () => setShowFirstSteps(true);
  const handleCloseFirstSteps = () => {
    setShowFirstSteps(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FIRST_STEPS_KEY, "1");
    }
  };

  const dismissPasswordReminder = () => {
    // Persist dismissal so we don't nag on every login.
    if (session?.email && typeof window !== "undefined") {
      window.localStorage.setItem(getPasswordPromptKey(session.email), "1");
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
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed", error);
      setIsLoggingOut(false);
    }
  };

  const [incidentPage, setIncidentPage] = useState(1);
  const INCIDENT_PAGE_SIZE = 10;
  const { data: incidentsResponse } = useIncidents(incidentFilters, {
    page: incidentPage,
    pageSize: INCIDENT_PAGE_SIZE
  });
  const invalidateIncidentsMain = useInvalidateIncidents();
  const incidents = incidentsResponse?.data ?? [];
  const incidentMeta = incidentsResponse?.meta;
  const maintenanceReference = new Date();
  const activeMaintenanceEvents = maintenanceEvents.filter((event) => {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    return (
      event.status === "in_progress" ||
      (event.status === "scheduled" && start <= maintenanceReference && end >= maintenanceReference)
    );
  });
  const upcomingMaintenanceEvents = maintenanceEvents.filter((event) => {
    const start = new Date(event.startsAt);
    return event.status === "scheduled" && start > maintenanceReference;
  });
  const formatMaintenanceRange = (event: MaintenanceEvent) =>
    `${format(new Date(event.startsAt), "PPpp")} → ${format(new Date(event.endsAt), "PPpp")}`;
  const analytics = analyticsQuery.data;
  const severityChartData = (analytics?.severityBreakdown ?? []).map((entry) => ({
    name: entry.severity,
    count: entry.count
  }));
  const serviceChartData = (analytics?.serviceBreakdown ?? []).map((entry) => ({
    name: entry.serviceName,
    count: entry.count
  }));
  const weeklyTrendData = (analytics?.weeklyTrend ?? []).map((entry) => ({
    bucket: format(new Date(entry.bucket), "MMM d"),
    count: entry.count
  }));
  const auditLogsQuery = useAuditLogs(Boolean(isAdmin), {
    action: auditActionFilter || undefined,
    search:
      auditSearch.trim().length >= 2
        ? auditSearch.trim()
        : undefined,
    page: auditPage,
    pageSize: AUDIT_PAGE_SIZE
  });
  const auditLogs = auditLogsQuery.data?.data ?? [];
  const auditMeta = auditLogsQuery.data?.meta;

  const teamUsersQuery = useTeamUsers(Boolean(isAdmin), {
    search: teamSearch.trim().length >= 2 ? teamSearch.trim() : undefined,
    page: teamPage,
    pageSize: TEAM_PAGE_SIZE
  });
  const teamUsers = teamUsersQuery.data?.data ?? [];
  const teamMeta = teamUsersQuery.data?.meta;
  const isTeamLoading = teamUsersQuery.isLoading && teamUsers.length === 0;
  const isTeamRefetching = teamUsersQuery.isFetching && !teamUsersQuery.isLoading;
  const { data: orgs = [] } = useOrganizations();
  const platformOrgs = usePlatformOrgs(Boolean(session?.isSuperAdmin)).data ?? [];
  const platformUsers = usePlatformUsers(Boolean(session?.isSuperAdmin)).data ?? [];
  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === session?.orgId),
    [orgs, session?.orgId]
  );

  useEffect(() => {
    if (incidentIdFromQuery) setSelectedIncidentId(incidentIdFromQuery);
    else setSelectedIncidentId(null);
  }, [incidentIdFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(FIRST_STEPS_KEY);
    if (!seen) setShowFirstSteps(true);
  }, []);

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
  const planLabel = session?.isSuperAdmin ? "super-admin" : currentOrg?.plan ?? "free";
  const billingStatus = currentOrg?.billingStatus ?? "active";
  const billingLocked = !session?.isSuperAdmin && billingStatus !== "active";
  const servicesUsed = servicesQuery.data ? servicesQuery.data.length : 0;
  const membersUsed = teamUsers.length;
  const incidentsUsed = incidents.length;
  const planLimits =
    planLabel === "free"
      ? { services: 2, members: 3, incidents: 50, orgs: 1 }
      : planLabel === "pro"
        ? { services: 10, members: 15, incidents: 500, orgs: 5 }
        : { services: undefined, members: undefined, incidents: undefined, orgs: undefined };

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

  const handleSimulateIncident = async () => {
    if (isSimulatingIncident) return;
    setIsSimulatingIncident(true);
    try {
      const defaultServiceId = serviceOptions[0]?.id ?? null;
      await apiClient.post("/incidents", {
        title: "Simulated incident",
        description: "Demo incident created from the Simulate button to show end-to-end flow.",
        severity: "medium",
        status: "investigating",
        serviceId: defaultServiceId,
        simulate: true
      });
      await invalidateIncidentsMain();
      window.alert("Simulated incident created. Check the incident list.");
    } catch (error) {
      let message = "Failed to simulate incident.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      window.alert(message);
    } finally {
      setIsSimulatingIncident(false);
    }
  };

  const navigation = [
    { id: "incidents", name: "Incidents", description: "Live incident feed", icon: "INC" },
    ...(isAdmin
      ? [
          { id: "team", name: "Team Management", description: "Manage roles & assignments", icon: "TEAM" },
          { id: "organizations", name: "Organizations", description: "Switch orgs & invites", icon: "ORG" },
          { id: "services", name: "Services", description: "Manage monitored services", icon: "SRV" },
          { id: "maintenance", name: "Maintenance", description: "Planned downtime & notices", icon: "MAINT" },
          { id: "audit", name: "System Audit", description: "Track logins & changes", icon: "AUD" },
          { id: "analytics", name: "Analytics", description: "Trends & reporting", icon: "DATA" },
          { id: "webhooks", name: "Automation", description: "Webhooks & notifications", icon: "AUTO" },
          { id: "billing", name: "Billing", description: "Plan & usage", icon: "BILL" },
          { id: "support", name: "Support", description: "Support tickets", icon: "SUP" },
          { id: "apiKeys", name: "API Keys", description: "Org keys", icon: "KEY" }
        ]
      : []),
    { id: "profile", name: "Profile", description: "Your account", icon: "USER" },
    { id: "password", name: "Security", description: "Update password", icon: "SEC" },
    ...(session?.isSuperAdmin
      ? [
          { id: "platformOps", name: "Platform", description: "Super-admin controls", icon: "OPS" },
          { id: "platformSupport", name: "Platform Support", description: "All tenant tickets", icon: "SADM" },
          { id: "platformBilling", name: "Platform Billing", description: "Tenant billing", icon: "BILL" }
        ]
      : [])
  ].map((item) => ({
    ...item,
    current: activeTab === item.id,
    onClick: () => setActiveTab(item.id as typeof activeTab)
  }));

  const iconFor = (id: string, current: boolean) => {
    const base = "h-5 w-5";
    const cls = current ? "text-white" : "text-gray-500 group-hover:text-blue-400";
    switch (id) {
      case "incidents":
        return <HomeIcon className={`${base} ${cls}`} />;
      case "team":
        return <UsersIcon className={`${base} ${cls}`} />;
      case "organizations":
        return <BuildingOfficeIcon className={`${base} ${cls}`} />;
      case "services":
        return <ServerStackIcon className={`${base} ${cls}`} />;
      case "maintenance":
        return <WrenchScrewdriverIcon className={`${base} ${cls}`} />;
      case "audit":
        return <ShieldCheckIcon className={`${base} ${cls}`} />;
      case "analytics":
        return <ChartBarIcon className={`${base} ${cls}`} />;
      case "webhooks":
        return <CpuChipIcon className={`${base} ${cls}`} />;
      case "billing":
        return <CreditCardIcon className={`${base} ${cls}`} />;
      case "support":
        return <LifebuoyIcon className={`${base} ${cls}`} />;
      case "apiKeys":
        return <KeyIcon className={`${base} ${cls}`} />;
      case "platformOps":
        return <ShieldCheckIcon className={`${base} ${cls}`} />;
      case "platformSupport":
        return <LifebuoyIcon className={`${base} ${cls}`} />;
      case "platformBilling":
        return <CreditCardIcon className={`${base} ${cls}`} />;
      default:
        return <HomeIcon className={`${base} ${cls}`} />;
    }
  };

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

  const filteredTeamUsers = teamUsers;

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
          <span className="mr-3 flex h-5 w-5 items-center justify-center">
            {iconFor(item.id, item.current)}
          </span>
          <div>
            <span className="text-sm font-semibold block">{item.name}</span>
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
                    disabled={billingLocked}
                    className="inline-flex items-center text-sm font-semibold py-2 px-4 rounded-full transition duration-150 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="w-4 h-4 mr-2 font-bold">+</span>
                    {billingLocked ? "Billing hold" : "+ New Incident"}
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleOpenFirstSteps}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-semibold text-blue-200 hover:border-blue-500 hover:text-white"
              >
                Show setup tips
              </button>
            </div>
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
                <div className="bg-gray-800 border border-blue-700 rounded-xl p-5 shadow-lg flex items-center justify-between col-span-full lg:col-span-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-400">Plan</p>
                    <p className="text-2xl font-bold text-white capitalize">{planLabel}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-blue-200">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-300">Services</span>
                        <span className="font-mono text-sm">
                          {servicesUsed}
                          {planLimits.services ? ` / ${planLimits.services}` : " (no cap)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-300">Members</span>
                        <span className="font-mono text-sm">
                          {membersUsed}
                          {planLimits.members ? ` / ${planLimits.members}` : " (no cap)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-300">Incidents</span>
                        <span className="font-mono text-sm">
                          {incidentsUsed}
                          {planLimits.incidents ? ` / ${planLimits.incidents}` : " (no cap)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-300">Orgs</span>
                        <span className="font-mono text-sm">
                          1
                          {planLimits.orgs ? ` / ${planLimits.orgs}` : " (no cap)"}
                        </span>
                      </div>
                    </div>
                    {billingLocked ? (
                      <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-900/40 px-3 py-2 text-xs text-amber-100">
                        Billing issue: payments failed or subscription lapsed. Update billing to restore write access.
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3 rounded-xl bg-blue-900/40 text-blue-200">
                    <CreditCardIcon className="h-6 w-6" />
                  </div>
                </div>
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
                    <button
                      type="button"
                      onClick={handleSimulateIncident}
                      disabled={isSimulatingIncident || billingLocked}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-600/20 disabled:opacity-50"
                    >
                      {isSimulatingIncident ? "Simulating..." : "Simulate incident"}
                    </button>
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
                {incidentMeta ? (
                  <div className="mt-6">
                    <Pagination
                      page={incidentMeta.page}
                      pageSize={incidentMeta.pageSize}
                      total={incidentMeta.total}
                      onPageChange={(nextPage) => setIncidentPage(nextPage)}
                    />
                  </div>
                ) : null}
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
                  {teamMeta ? (
                    <div className="mt-6">
                      <Pagination
                        page={teamMeta.page}
                        pageSize={teamMeta.pageSize}
                        total={teamMeta.total}
                        onPageChange={(nextPage) => setTeamPage(nextPage)}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'organizations' && isAdmin && (
              <OrganizationsPanel session={session} />
            )}

            {activeTab === 'maintenance' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-8 shadow-lg">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-300">Planned Downtime</p>
                    <h2 className="text-2xl font-bold text-white">Scheduled Maintenance</h2>
                    <p className="text-sm text-amber-100">
                      Publish maintenance windows separately from incidents so customers know what to expect.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <form
                    onSubmit={handleMaintenanceSubmit}
                    className="rounded-xl border border-amber-500/40 bg-gray-900/60 p-6 space-y-4 shadow-inner"
                  >
                    <div>
                      <label className="text-xs font-semibold uppercase text-amber-200">Title</label>
                      <input
                        type="text"
                        name="title"
                        value={maintenanceForm.title}
                        onChange={handleMaintenanceFieldChange}
                        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-400 focus:ring-amber-500"
                        placeholder="Database maintenance"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-amber-200">Description</label>
                      <textarea
                        name="description"
                        value={maintenanceForm.description}
                        onChange={handleMaintenanceFieldChange}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-400 focus:ring-amber-500"
                        placeholder="Describe customer impact and planned actions"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase text-amber-200">
                        Starts at
                        <input
                          type="datetime-local"
                          name="start"
                          value={maintenanceForm.start}
                          onChange={handleMaintenanceFieldChange}
                          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-400 focus:ring-amber-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase text-amber-200">
                        Ends at
                        <input
                          type="datetime-local"
                          name="end"
                          value={maintenanceForm.end}
                          onChange={handleMaintenanceFieldChange}
                          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-400 focus:ring-amber-500"
                          required
                        />
                      </label>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 space-y-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          name="appliesToAll"
                          checked={maintenanceForm.appliesToAll}
                          onChange={handleMaintenanceFieldChange}
                          className="rounded border-gray-600 bg-gray-900 text-amber-500 focus:ring-amber-400"
                        />
                        Applies to all services
                      </label>
                      {!maintenanceForm.appliesToAll ? (
                        <label className="block text-xs font-semibold uppercase text-amber-200">
                          Target service
                          <select
                            name="serviceId"
                            value={maintenanceForm.serviceId}
                            onChange={handleMaintenanceFieldChange}
                            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-400 focus:ring-amber-500"
                          >
                            <option value="">Select service...</option>
                            {serviceOptions.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                    {maintenanceError ? (
                      <p className="text-sm text-red-400">{maintenanceError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={createMaintenanceEvent.isPending}
                      className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-60"
                    >
                      {createMaintenanceEvent.isPending ? "Scheduling..." : "Schedule maintenance"}
                    </button>
                  </form>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                          Active windows
                        </h3>
                        {maintenanceEventsQuery.isFetching ? (
                          <p className="text-xs text-amber-200">Refreshing...</p>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-3">
                        {maintenanceEventsQuery.isLoading ? (
                          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">
                            Loading maintenance schedule...
                          </div>
                        ) : activeMaintenanceEvents.length === 0 ? (
                          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">
                            No active maintenance windows.
                          </div>
                        ) : (
                          activeMaintenanceEvents.map((event) => (
                            <div key={event.id} className="rounded-lg border border-amber-500/40 bg-gray-900 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-white">{event.title}</p>
                                  <p className="text-xs text-gray-400">
                                    {event.appliesToAll
                                      ? "All services"
                                      : event.service?.name ?? "Selected services"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCancelMaintenance(event.id)}
                                  disabled={cancelMaintenanceEvent.isPending}
                                  className="text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-gray-400">{formatMaintenanceRange(event)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                        Upcoming windows
                      </h3>
                      <div className="mt-3 space-y-3">
                        {upcomingMaintenanceEvents.length === 0 ? (
                          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">
                            No upcoming maintenance scheduled.
                          </div>
                        ) : (
                          upcomingMaintenanceEvents.map((event) => (
                            <div key={event.id} className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-white">{event.title}</p>
                                  <p className="text-xs text-gray-400">
                                    {event.appliesToAll
                                      ? "All services"
                                      : event.service?.name ?? "Selected services"}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-400">{formatMaintenanceRange(event)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-8 shadow-lg">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-purple-300">Analytics</p>
                    <h2 className="text-2xl font-bold text-white">Operations Insights</h2>
                    <p className="text-sm text-purple-100">
                      Track MTTR, SLA performance, and incident trends across services and severities.
                    </p>
                  </div>
                  {analyticsQuery.isFetching ? (
                    <p className="text-xs text-purple-200">Refreshing...</p>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Average resolution (30d)"
                    value={`${analytics?.avgResolutionMinutes ?? 0} min`}
                    description="Mean time to resolve incidents"
                  />
                  <StatCard
                    label="Average first response (30d)"
                    value={`${analytics?.avgFirstResponseMinutes ?? 0} min`}
                    description="Mean time to first responder action"
                  />
                  <StatCard
                    label="Active maintenance"
                    value={activeMaintenanceEvents.length.toString()}
                    description="Windows currently in progress"
                  />
                  <StatCard
                    label="Upcoming maintenance"
                    value={upcomingMaintenanceEvents.length.toString()}
                    description="Scheduled windows in next 90d"
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard title="Incidents by severity">
                    {analyticsQuery.isLoading ? (
                      <LoadingState message="Loading severity breakdown..." />
                    ) : severityChartData.length === 0 ? (
                      <EmptyState message="No incidents recorded in the past 30 days." />
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={severityChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" stroke="#cbd5f5" />
                          <YAxis stroke="#cbd5f5" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#111827", borderColor: "#374151" }}
                            labelStyle={{ color: "#e5e7eb" }}
                          />
                          <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard title="Incidents by service">
                    {analyticsQuery.isLoading ? (
                      <LoadingState message="Loading service distribution..." />
                    ) : serviceChartData.length === 0 ? (
                      <EmptyState message="No service-level incidents recorded recently." />
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={serviceChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" stroke="#cbd5f5" hide />
                          <YAxis stroke="#cbd5f5" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#111827", borderColor: "#374151" }}
                            labelStyle={{ color: "#e5e7eb" }}
                          />
                          <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <ChartCard title="Weekly incident trend (last 12 weeks)">
                  {analyticsQuery.isLoading ? (
                    <LoadingState message="Loading trend..." />
                  ) : weeklyTrendData.length === 0 ? (
                    <EmptyState message="No weekly trend data available." />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="bucket" stroke="#cbd5f5" />
                        <YAxis stroke="#cbd5f5" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#111827", borderColor: "#374151" }}
                          labelStyle={{ color: "#e5e7eb" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#34d399"
                          strokeWidth={2}
                          dot={{ stroke: "#34d399", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            )}

            {activeTab === 'audit' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">System audit</p>
                    <h2 className="text-2xl font-bold text-white">Audit Log</h2>
                    <p className="text-sm text-gray-400">
                      Trace logins, incident changes, and user management activity in one place.
                    </p>
                  </div>
                  {auditLogsQuery.isFetching ? (
                    <p className="text-xs text-gray-500">Refreshing…</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                      placeholder="Search actor, target, or ID…"
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={auditActionFilter}
                    onChange={(event) => setAuditActionFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {auditActionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-inner">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Timestamp</th>
                        <th className="px-4 py-3 text-left">Action</th>
                        <th className="px-4 py-3 text-left">Actor</th>
                        <th className="px-4 py-3 text-left">Target</th>
                        <th className="px-4 py-3 text-left">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-sm text-gray-300">
                      {auditLogsQuery.isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-5 text-center text-gray-500">
                            Loading audit events…
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-5 text-center text-gray-500">
                            No audit events match your filters.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-800/60 transition">
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {format(new Date(log.createdAt), "PPpp")}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-gray-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-200">
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.actorName ?? log.actorEmail ?? "System"}
                              {log.actorEmail && log.actorName ? (
                                <span className="block text-xs text-gray-500">{log.actorEmail}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {log.targetType ? (
                                <span>
                                  {log.targetType}
                                  {log.targetId ? ` • ${log.targetId}` : ""}
                                </span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {log.metadata ? (
                                <code className="block max-w-xs overflow-hidden text-ellipsis whitespace-nowrap rounded bg-gray-900/80 px-2 py-1 text-gray-300">
                                  {JSON.stringify(log.metadata)}
                                </code>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {auditMeta ? (
                  <Pagination
                    page={auditMeta.page}
                    pageSize={auditMeta.pageSize}
                    total={auditMeta.total}
                    onPageChange={(nextPage) => setAuditPage(nextPage)}
                  />
                ) : null}
              </div>
            )}

            {activeTab === 'billing' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-blue-300">Billing</p>
                  <h2 className="text-2xl font-bold text-white">Plan & usage</h2>
                  <p className="text-sm text-gray-300">
                    Current plan: <span className="font-semibold capitalize">{planLabel}</span>{" "}
                    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                      billingStatus === "active"
                        ? "bg-green-900/60 text-green-200"
                        : "bg-amber-900/70 text-amber-100"
                    }`}>
                      {billingStatus}
                    </span>
                  </p>
                  {billingLocked ? (
                    <p className="text-xs text-amber-200">
                      Subscription is past due or canceled. Renew to restore write access.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setPortalLoading(true);
                        const url = await openPortal.mutateAsync();
                        if (url) window.open(url, "_blank", "noreferrer");
                      } finally {
                        setPortalLoading(false);
                      }
                    }}
                    disabled={portalLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
                  >
                    <CreditCardIcon className="h-4 w-4" />
                    {portalLoading ? "Opening portal..." : "Open billing portal"}
                  </button>
                  {planLabel === "free" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setCheckoutPlanLoading("pro");
                          const url = await startCheckout.mutateAsync("pro");
                          if (url) window.location.href = url;
                        } finally {
                          setCheckoutPlanLoading(null);
                        }
                      }}
                      disabled={checkoutPlanLoading !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {checkoutPlanLoading === "pro" ? "Redirecting..." : "Upgrade to Pro"}
                    </button>
                  )}
                  {planLabel === "pro" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setCheckoutPlanLoading("enterprise");
                          const url = await startCheckout.mutateAsync("enterprise");
                          if (url) window.location.href = url;
                        } finally {
                          setCheckoutPlanLoading(null);
                        }
                      }}
                      disabled={checkoutPlanLoading !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      {checkoutPlanLoading === "enterprise" ? "Redirecting..." : "Upgrade to Enterprise"}
                    </button>
                  )}
                  {planLabel === "enterprise" && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 opacity-60 cursor-not-allowed"
                    >
                      Enterprise active
                    </button>
                  )}
                  {billingLocked && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const targetPlan = planLabel === "enterprise" ? "enterprise" : "pro";
                          setCheckoutPlanLoading(targetPlan);
                          const url = await startCheckout.mutateAsync(targetPlan);
                          if (url) window.location.href = url;
                        } finally {
                          setCheckoutPlanLoading(null);
                        }
                      }}
                      disabled={checkoutPlanLoading !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {checkoutPlanLoading ? "Redirecting..." : "Pay / Renew"}
                    </button>
                  )}
                </div>
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Invoices</p>
                  {invoicesQuery.isLoading ? (
                    <p className="text-sm text-gray-400">Loading invoices...</p>
                  ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-gray-200">
                        <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left">Number</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Total</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {invoicesQuery.data.map((inv) => (
                            <tr key={inv.id}>
                              <td className="px-3 py-2">{inv.number ?? inv.id}</td>
                              <td className="px-3 py-2 capitalize">{inv.status}</td>
                              <td className="px-3 py-2">
                                {(inv.total / 100).toFixed(2)} {inv.currency.toUpperCase()}
                              </td>
                              <td className="px-3 py-2">
                                {inv.createdAt ? new Date(inv.createdAt * 1000).toLocaleDateString() : ""}
                              </td>
                              <td className="px-3 py-2">
                                {inv.hostedInvoiceUrl ? (
                                  <a
                                    href={inv.hostedInvoiceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-300 hover:text-blue-100"
                                  >
                                    View
                                  </a>
                                ) : inv.invoicePdf ? (
                                  <a
                                    href={inv.invoicePdf}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-300 hover:text-blue-100"
                                  >
                                    PDF
                                  </a>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No invoices found.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              <SupportPanel />
            )}

            {activeTab === 'platformSupport' && session?.isSuperAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                  <p className="text-xs uppercase tracking-wide text-blue-300">Platform Support</p>
                  <h2 className="text-2xl font-bold text-white">All tenant tickets</h2>
                  <p className="text-sm text-gray-300">
                    Triage and respond to every organization’s tickets. Add internal notes, reassign, and update status.
                  </p>
                </div>
                <PlatformSupportPanel orgs={platformOrgs} users={platformUsers} />
              </div>
            )}

            {activeTab === 'services' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                  <p className="text-xs uppercase tracking-wide text-blue-300">Services</p>
                  <h2 className="text-2xl font-bold text-white">Monitored services</h2>
                  <p className="text-sm text-gray-300">
                    Define the systems you monitor, and attach incidents and maintenance windows to them.
                  </p>
                </div>
                <ServiceManagementPanel
                  services={servicesQuery.data}
                  isLoading={servicesQuery.isLoading}
                  onCreate={handleCreateService}
                  onUpdate={handleUpdateService}
                  onDelete={handleDeleteService}
                  isMutating={serviceMutationsPending}
                />
              </div>
            )}

            {activeTab === 'apiKeys' && isAdmin && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:p-8 space-y-6 shadow-lg">
                <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                  <p className="text-xs uppercase tracking-wide text-blue-300">API Keys</p>
                  <h2 className="text-2xl font-bold text-white">Org-scoped API keys</h2>
                  <p className="text-sm text-gray-300">
                    Generate keys for automation and webhooks. Keys are shown only once—copy and store them securely.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/docs#api-keys"
                      className="inline-flex items-center gap-2 rounded-full border border-blue-400 px-4 py-2 text-xs font-semibold text-blue-100 hover:border-blue-200 hover:text-white transition"
                    >
                      View API key docs
                    </Link>
                  </div>
                </div>

                {apiKeyError ? (
                  <div className="rounded-lg border border-red-500/50 bg-red-900/40 px-4 py-2 text-sm text-red-100">
                    {apiKeyError}
                  </div>
                ) : null}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setApiKeyError(null);
                    if (!newApiKeyName.trim()) {
                      setApiKeyError("Name is required.");
                      return;
                    }
                    try {
                      const key = await createApiKey.mutateAsync(newApiKeyName.trim());
                      setLastCreatedKey(key);
                      setNewApiKeyName("");
                    } catch (error) {
                      if (isAxiosError(error)) {
                        setApiKeyError(error.response?.data?.message ?? "Unable to create API key.");
                      } else {
                        setApiKeyError("Unable to create API key.");
                      }
                    }
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3"
                >
                  <label className="text-sm font-semibold text-gray-200">Key name</label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="Ops key, Monitoring key..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={createApiKey.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {createApiKey.isPending ? "Generating..." : "Generate key"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Keys inherit the current organization scope. Rotate regularly and delete unused keys.
                  </p>
                </form>

                {lastCreatedKey ? (
                  <div className="rounded-lg border border-green-500/40 bg-green-900/40 p-4 text-sm text-green-100 space-y-2">
                    <p className="font-semibold text-white">New key created</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <code className="rounded bg-green-950 px-3 py-2 text-green-100 break-all">
                        {lastCreatedKey}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(lastCreatedKey);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-md border border-green-400 px-3 py-2 text-xs font-semibold text-green-100 hover:border-green-200 hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-green-200/80">
                      Store this key securely. You will not be able to see it again.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-lg border border-gray-700 bg-gray-900 shadow-inner">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-200">Existing keys</h3>
                  </div>
                  {apiKeysQuery.isLoading ? (
                    <div className="p-4 text-sm text-gray-400">Loading keys...</div>
                  ) : apiKeysQuery.data && apiKeysQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-gray-200">
                        <thead className="text-xs uppercase text-gray-400 border-b border-gray-700 bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Created</th>
                            <th className="px-3 py-2 text-left">Last used</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {apiKeysQuery.data.map((key: ApiKey) => (
                            <tr key={key.id}>
                              <td className="px-3 py-2 font-semibold text-white">{key.name}</td>
                              <td className="px-3 py-2 text-gray-300">
                                {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-400">
                                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteApiKey.mutate(key.id)}
                                  className="inline-flex items-center gap-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:text-white"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-400">No API keys created yet.</div>
                  )}
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

        <FirstStepsModal open={showFirstSteps} onClose={handleCloseFirstSteps} />

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
                disabled={!canCreate || billingLocked}
                onSuccess={() => setIsNewIncidentOpen(false)}
                services={serviceOptions}
              />
            </div>
          </div>
        )}
        {billingLocked ? (
          <div className="fixed top-0 left-0 right-0 z-40 bg-amber-900/90 backdrop-blur-sm border-b border-amber-500/60">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-amber-100 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-800/70 text-xs font-bold uppercase">
                  Billing
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Billing issue on this workspace ({billingStatus}). Writes are blocked until payment is updated.
                  </p>
                  <p className="text-xs text-amber-200/90">
                    Retry payment to restore access, or contact support if you need help.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const targetPlan = planLabel === "enterprise" ? "enterprise" : "pro";
                    try {
                      setCheckoutPlanLoading(targetPlan);
                      const url = await startCheckout.mutateAsync(targetPlan);
                      if (url) window.location.href = url;
                    } finally {
                      setCheckoutPlanLoading(null);
                    }
                  }}
                  disabled={checkoutPlanLoading !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {checkoutPlanLoading ? "Redirecting..." : "Pay / Renew"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setPortalLoading(true);
                      const url = await openPortal.mutateAsync();
                      if (url) window.open(url, "_blank", "noreferrer");
                    } finally {
                      setPortalLoading(false);
                    }
                  }}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-600 disabled:opacity-60"
                >
                  {portalLoading ? "Opening portal..." : "Update payment method"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
