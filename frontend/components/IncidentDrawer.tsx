"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { useIncidentDetail, useInvalidateIncidents, useDeleteIncident } from "@hooks/useIncidents";
import { apiClient } from "@lib/api-client";
import { formatDate, formatRelative } from "@lib/format";
import type { IncidentSeverity, IncidentStatus, IncidentAttachment } from "@lib/types";
import {
  buildAttachmentUrl,
  deleteIncidentAttachment,
  formatAttachmentSize,
  MAX_ATTACHMENTS_PER_BATCH,
  uploadIncidentAttachment
} from "@lib/attachments";
import { SeverityBadge } from "./SeverityBadge";
import type { TeamUser } from "@hooks/useTeamUsers";
import type { ServiceRecord } from "@hooks/useServices";

type Props = {
  incidentId?: string;
  open: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    role: "admin" | "operator" | "viewer";
  };
  teamUsers?: TeamUser[];
  services?: ServiceRecord[];
};

type UpdatePayload = {
  message: string;
  attachmentIds?: string[];
};

type UpdateResponse = {
  error: boolean;
  data: {
    id: string;
  };
};

type PatchIncidentPayload = Partial<{
  status: IncidentStatus;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  assignedToId: string | null;
  categories: string[];
  impactScope: string | null;
  serviceId: string;
  rootCause: string;
  resolutionSummary: string;
}>;

export function IncidentDrawer({
  incidentId,
  open,
  onClose,
  currentUser,
  teamUsers = [],
  services = []
}: Props) {
  const { data, isLoading } = useIncidentDetail(incidentId);
  const invalidateIncidents = useInvalidateIncidents();
  const queryClient = useQueryClient();
  const [updateMessage, setUpdateMessage] = useState("");
  const [statusChangePending, setStatusChangePending] = useState<IncidentStatus | null>(null);
const [assignmentChangePending, setAssignmentChangePending] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    severity: IncidentSeverity;
    description: string;
    categoriesText: string;
    impactScope: string;
    serviceId: string;
  }>({
    title: "",
    severity: "medium",
    description: "",
    categoriesText: "",
    impactScope: "",
    serviceId: ""
  });
  const [pendingAttachments, setPendingAttachments] = useState<IncidentAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isResolutionPromptVisible, setIsResolutionPromptVisible] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({
    rootCause: "",
    resolutionSummary: ""
  });
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const deleteIncident = useDeleteIncident();

  const isAdmin = currentUser.role === "admin";
  const availableAssignees = useMemo(
    () => teamUsers.filter((user) => user.isActive),
    [teamUsers]
  );

  const addUpdateMutation = useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      if (!incidentId) {
        throw new Error("Incident ID missing");
      }
      const response = await apiClient.post<UpdateResponse>(
        `/incidents/${incidentId}/update-log`,
        payload
      );
      return response.data;
    },
    onSuccess: async () => {
      setUpdateMessage("");
      setPendingAttachments([]);
      setAttachmentError(null);
      await Promise.all([
        invalidateIncidents(),
        queryClient.invalidateQueries({ queryKey: ["incident", incidentId] })
      ]);
    }
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async (payload: PatchIncidentPayload) => {
      if (!incidentId) {
        throw new Error("Incident ID missing");
      }
      const response = await apiClient.patch(`/incidents/${incidentId}`, payload);
      return response.data;
    },
    onSuccess: async () => {
      setStatusChangePending(null);
      setAssignmentChangePending(null);
      await Promise.all([
        invalidateIncidents(),
        queryClient.invalidateQueries({ queryKey: ["incident", incidentId] })
      ]);
    },
    onError: () => {
      setStatusChangePending(null);
      setAssignmentChangePending(null);
    }
  });

  const incident = data?.data;
  const timeline = incident?.updates ?? [];

  useEffect(() => {
    if (!incident) {
      return;
    }
    setEditForm({
      title: incident.title,
      severity: incident.severity,
      description: incident.description,
      categoriesText: (incident.categories ?? []).join(", "),
      impactScope: incident.impactScope ?? "",
      serviceId: incident.service?.id ?? ""
    });
  }, [incident, open]);

  useEffect(() => {
    setIsEditingDetails(false);
    setDetailError(null);
    setPendingAttachments([]);
    setAttachmentError(null);
  }, [incidentId]);

  useEffect(() => {
    if (!open) {
      setPendingAttachments([]);
      setAttachmentError(null);
      setIsUploadingAttachment(false);
    }
  }, [open]);

  useEffect(() => {
    if (incident?.status !== "resolved") {
      setIsResolutionPromptVisible(false);
      setResolutionError(null);
    }
  }, [incident?.status]);

  const canCollaborate =
    incident &&
    (isAdmin ||
      (currentUser.role === "operator" &&
        (incident.createdById === currentUser.id || incident.assignedToId === currentUser.id)));
  const canEditDetails = Boolean(canCollaborate);
  const attachmentLimitReached = pendingAttachments.length >= MAX_ATTACHMENTS_PER_BATCH;
  const standaloneAttachments = useMemo(
    () => (incident?.attachments ?? []).filter((attachment) => !attachment.updateId),
    [incident?.attachments]
  );

  const handleAttachmentSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    if (pendingAttachments.length + files.length > MAX_ATTACHMENTS_PER_BATCH) {
      setAttachmentError(`Attach up to ${MAX_ATTACHMENTS_PER_BATCH} files per update.`);
      event.target.value = "";
      return;
    }

    setAttachmentError(null);
    setIsUploadingAttachment(true);

    for (const file of files) {
      try {
        if (!incidentId) {
          throw new Error("Incident ID missing");
        }
        const uploaded = await uploadIncidentAttachment(incidentId, file);
        setPendingAttachments((prev) => [...prev, uploaded]);
      } catch (error) {
        let message = "Failed to upload attachment.";
        if (isAxiosError(error)) {
          message = error.response?.data?.message ?? error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        setAttachmentError(message);
        break;
      }
    }

    setIsUploadingAttachment(false);
    event.target.value = "";
  };

  const handleRemovePendingAttachment = async (attachmentId: string) => {
    try {
      if (!incidentId) {
        throw new Error("Incident ID missing");
      }
      await deleteIncidentAttachment(incidentId, attachmentId);
      setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    } catch (error) {
      let message = "Failed to remove attachment.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setAttachmentError(message);
    }
  };

  const handleStatusChange = (status: IncidentStatus) => {
    if (!incident || incident.status === status) {
      return;
    }

    if (status === "resolved") {
      setResolutionForm({
        rootCause: incident.rootCause ?? "",
        resolutionSummary: incident.resolutionSummary ?? ""
      });
      setResolutionError(null);
      setIsResolutionPromptVisible(true);
      return;
    }

    setStatusChangePending(status);
    updateIncidentMutation.mutate({ status });
  };

  const handleResolutionFieldChange = (
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setResolutionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelResolutionPrompt = () => {
    setIsResolutionPromptVisible(false);
    setResolutionError(null);
  };

  const handleSubmitResolutionPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!incidentId) {
      return;
    }
    const trimmedRootCause = resolutionForm.rootCause.trim();
    const trimmedSummary = resolutionForm.resolutionSummary.trim();

    if (trimmedRootCause.length < 10) {
      setResolutionError("Root cause must be at least 10 characters.");
      return;
    }

    if (trimmedSummary.length < 10) {
      setResolutionError("Resolution summary must be at least 10 characters.");
      return;
    }

    setResolutionError(null);
    setStatusChangePending("resolved");
    updateIncidentMutation.mutate(
      {
        status: "resolved",
        rootCause: trimmedRootCause,
        resolutionSummary: trimmedSummary
      },
      {
        onSuccess: () => {
          setIsResolutionPromptVisible(false);
        },
        onError: (error) => {
          let message = "Failed to resolve incident.";
          if (isAxiosError(error)) {
            message = error.response?.data?.message ?? error.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          setResolutionError(message);
        }
      }
    );
  };

  const handleAssignmentChange = (assigneeId: string) => {
    if (!incident) {
      return;
    }
    const nextAssignee = assigneeId === "unassigned" ? null : assigneeId;
    if ((incident.assignedToId ?? null) === nextAssignee) {
      return;
    }
    setAssignmentChangePending(nextAssignee ?? "unassigned");
    updateIncidentMutation.mutate({ assignedToId: nextAssignee });
  };

  const handleSubmitUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!updateMessage.trim() || isUploadingAttachment) {
      return;
    }
    addUpdateMutation.mutate({
      message: updateMessage.trim(),
      attachmentIds: pendingAttachments.map((attachment) => attachment.id)
    });
  };

  const handleDetailFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelEditDetails = () => {
    if (incident) {
      setEditForm({
        title: incident.title,
        severity: incident.severity,
        description: incident.description,
        categoriesText: (incident.categories ?? []).join(", "),
        impactScope: incident.impactScope ?? "",
        serviceId: incident.service?.id ?? ""
      });
    }
    setIsEditingDetails(false);
    setDetailError(null);
  };

  const handleDetailSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!incidentId) {
      return;
    }

    const trimmedTitle = editForm.title.trim();
    const trimmedDescription = editForm.description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setDetailError("Title and description are required.");
      return;
    }

    const categories = editForm.categoriesText
      .split(",")
      .map((category) => category.trim())
      .filter((category) => category.length > 0);

    const payload: PatchIncidentPayload = {
      title: trimmedTitle,
      severity: editForm.severity,
      description: trimmedDescription,
      categories,
      impactScope: editForm.impactScope.trim() ? editForm.impactScope.trim() : null
    };

    if (isAdmin && editForm.serviceId) {
      payload.serviceId = editForm.serviceId;
    }

    setDetailError(null);
    updateIncidentMutation.mutate(payload, {
      onSuccess: () => {
        setIsEditingDetails(false);
        setDetailError(null);
      },
      onError: (error) => {
        let message = "Failed to update incident details.";
        if (isAxiosError(error)) {
          message = error.response?.data?.message ?? error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        setDetailError(message);
      }
    });
  };

  const handleDeleteIncident = () => {
    if (!incidentId || !isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this incident? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    deleteIncident.mutate(incidentId, {
      onSuccess: () => {
        onClose();
        setDetailError(null);
      },
      onError: (error) => {
        let message = "Failed to delete incident.";
        if (isAxiosError(error)) {
          message = error.response?.data?.message ?? error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        window.alert(message);
      }
    });
  };

  const handleToggleEditDetails = () => {
    if (isEditingDetails) {
      handleCancelEditDetails();
    } else {
      setDetailError(null);
      setIsEditingDetails(true);
    }
  };

  const statusButtons: IncidentStatus[] = ["open", "investigating", "monitoring", "resolved"];
  const severityOptions: IncidentSeverity[] = ["low", "medium", "high", "critical"];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-200"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl bg-white shadow-xl">
                  <div className="flex h-full flex-col overflow-y-auto">
                    <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                      <div>
                        <Dialog.Title className="text-lg font-semibold text-slate-900">
                          {incident?.title ?? "Incident"}
                        </Dialog.Title>
                        <p className="mt-1 text-sm text-slate-500">
                          Created {incident ? formatRelative(incident.createdAt) : "Not available"}
                        </p>
                        {incident?.service ? (
                          <p className="text-xs text-slate-500">
                            Service: <span className="font-semibold text-slate-800">{incident.service.name}</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {incident ? <SeverityBadge severity={incident.severity} /> : null}
                        {incident && canEditDetails ? (
                          <button
                            type="button"
                            onClick={handleToggleEditDetails}
                            disabled={updateIncidentMutation.isPending && isEditingDetails}
                            className="rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isEditingDetails ? "Cancel edit" : "Edit details"}
                          </button>
                        ) : null}
                        {incident && isAdmin ? (
                          <button
                            type="button"
                            onClick={handleDeleteIncident}
                            disabled={deleteIncident.isPending}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleteIncident.isPending ? "Deleting..." : "Delete"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={onClose}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                        Loading incident...
                      </div>
                    ) : incident ? (
                      <div className="flex flex-1 flex-col gap-6 px-6 py-6">
                        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-semibold text-slate-800">Details</h3>
                          </div>
                          {detailError ? (
                            <p className="mt-3 text-xs text-red-600">{detailError}</p>
                          ) : null}
                          {isEditingDetails ? (
                            <form onSubmit={handleDetailSubmit} className="mt-4 space-y-4">
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Title
                                  <input
                                    name="title"
                                    disabled={updateIncidentMutation.isPending}
                                    value={editForm.title}
                                    onChange={handleDetailFieldChange}
                                    required
                                    minLength={3}
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Severity
                                  <select
                                    name="severity"
                                    disabled={updateIncidentMutation.isPending}
                                    value={editForm.severity}
                                    onChange={handleDetailFieldChange}
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {severityOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {option.charAt(0).toUpperCase() + option.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Service
                                <select
                                  name="serviceId"
                                  disabled={!isAdmin || updateIncidentMutation.isPending || services.length === 0}
                                  value={editForm.serviceId}
                                  onChange={handleDetailFieldChange}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                      {service.name}
                                    </option>
                                  ))}
                                </select>
                                {!isAdmin ? (
                                  <span className="mt-1 block text-[10px] text-slate-500">
                                    Only admins can change service ownership.
                                  </span>
                                ) : null}
                              </label>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Description
                                <textarea
                                  name="description"
                                  disabled={updateIncidentMutation.isPending}
                                  value={editForm.description}
                                  onChange={handleDetailFieldChange}
                                  rows={4}
                                  required
                                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </label>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Impact scope
                                  <input
                                    name="impactScope"
                                    disabled={updateIncidentMutation.isPending}
                                    value={editForm.impactScope}
                                    onChange={handleDetailFieldChange}
                                    placeholder="e.g. Payments, API"
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Categories
                                  <input
                                    name="categoriesText"
                                    disabled={updateIncidentMutation.isPending}
                                    value={editForm.categoriesText}
                                    onChange={handleDetailFieldChange}
                                    placeholder="infra, database, comms"
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </label>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditDetails}
                                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={updateIncidentMutation.isPending}
                                  className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updateIncidentMutation.isPending ? "Saving..." : "Save changes"}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <p className="mt-2 whitespace-pre-line leading-relaxed">
                                {incident.description}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                                  Reporter: {incident.createdBy?.name ?? "Unknown"}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                                  Owner: {incident.assignedTo?.name ?? "Unassigned"}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                Service: {incident.service?.name ?? "Unassigned"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Impact scope: {incident.impactScope ?? "Not specified"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Categories: {incident.categories?.length ? incident.categories.join(", ") : "None"}
                              </div>
                          <div className="mt-4 text-xs text-slate-500">
                            First response: {incident.firstResponseAt ? formatRelative(incident.firstResponseAt) : "Pending"}
                            {" - "}
                            Resolved: {incident.resolvedAt ? formatRelative(incident.resolvedAt) : "Open"}
                          </div>
                          {standaloneAttachments.length > 0 ? (
                            <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Attached evidence
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {standaloneAttachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={buildAttachmentUrl(attachment.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    <span className="font-medium">{attachment.filename}</span>
                                    <span className="text-[11px] text-slate-400">
                                      {formatAttachmentSize(attachment.size)}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {incident.status === "resolved" ? (
                            <div className="mt-4 grid gap-4 rounded-lg border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                  Root cause
                                </p>
                                <p className="mt-1 whitespace-pre-line text-emerald-900">
                                  {incident.rootCause?.trim() || "Not documented yet."}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                  Resolution summary
                                </p>
                                <p className="mt-1 whitespace-pre-line text-emerald-900">
                                  {incident.resolutionSummary?.trim() || "Not documented yet."}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </section>

                        {isAdmin ? (
                          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-800">Assignment</h3>
                            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  Current assignee
                                </p>
                                <p className="text-sm text-slate-700">
                                  {incident.assignedTo
                                    ? `${incident.assignedTo.name} (${incident.assignedTo.teamRoles.join(", ") || incident.assignedTo.role})`
                                    : "Unassigned"}
                                </p>
                              </div>
                              <select
                                name="assignedToId"
                                value={incident.assignedToId ?? "unassigned"}
                                onChange={(event) => handleAssignmentChange(event.target.value)}
                                disabled={updateIncidentMutation.isPending}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                              >
                                <option value="unassigned">Unassigned</option>
                                {availableAssignees.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name} ({user.teamRoles.join(", ") || user.role})
                                  </option>
                                ))}
                              </select>
                            </div>
                            {assignmentChangePending !== null ? (
                              <p className="mt-2 text-xs text-slate-500">
                                Updating assignment...
                              </p>
                            ) : null}
                          </section>
                        ) : null}

                        <section>
                          <h3 className="text-sm font-semibold text-slate-800">Status</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {statusButtons.map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={!canCollaborate || updateIncidentMutation.isPending}
                                onClick={() => handleStatusChange(status)}
                                className={clsx(
                                  "rounded-md border px-3 py-1.5 text-sm capitalize transition",
                                  incident.status === status
                                    ? "border-brand-500 bg-brand-50 text-brand-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                                  statusChangePending === status ? "animate-pulse" : ""
                                )}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                          {isResolutionPromptVisible ? (
                            <form
                              onSubmit={handleSubmitResolutionPrompt}
                              className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900"
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Document root cause & resolution to close this incident
                              </p>
                              <label className="block text-xs font-semibold text-amber-800">
                                Root cause
                                <textarea
                                  name="rootCause"
                                  value={resolutionForm.rootCause}
                                  onChange={handleResolutionFieldChange}
                                  rows={3}
                                  className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  placeholder="Explain the underlying issue, e.g. 'Redis cache exhausted connections due to runaway cron job'."
                                  required
                                  disabled={updateIncidentMutation.isPending}
                                />
                              </label>
                              <label className="block text-xs font-semibold text-amber-800">
                                Resolution summary
                                <textarea
                                  name="resolutionSummary"
                                  value={resolutionForm.resolutionSummary}
                                  onChange={handleResolutionFieldChange}
                                  rows={3}
                                  className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  placeholder="Describe the fix and follow-up, e.g. 'Rolled back build 542, doubled cache nodes, added connection alarms'."
                                  required
                                  disabled={updateIncidentMutation.isPending}
                                />
                              </label>
                              {resolutionError ? (
                                <p className="text-xs font-semibold text-red-500">{resolutionError}</p>
                              ) : (
                                <p className="text-[11px] text-amber-700">
                                  These notes feed historical reports and compliance exports.
                                </p>
                              )}
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelResolutionPrompt}
                                  className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                                  disabled={updateIncidentMutation.isPending}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-70"
                                  disabled={updateIncidentMutation.isPending}
                                >
                                  {updateIncidentMutation.isPending ? "Saving..." : "Resolve incident"}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </section>

                        <section className="flex-1">
                          <h3 className="text-sm font-semibold text-slate-800">Timeline</h3>
                          <div className="mt-3 space-y-4">
                            {timeline.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No updates yet. Share progress to keep everyone informed.
                              </p>
                            ) : (
                              timeline.map((update) => (
                                <div
                                  key={update.id}
                              className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm"
                            >
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{update.author.name}</span>
                                <span>{formatDate(update.createdAt)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-line text-slate-700">
                                {update.message}
                              </p>
                              {update.attachments && update.attachments.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {update.attachments.map((attachment) => (
                                    <a
                                      key={attachment.id}
                                      href={buildAttachmentUrl(attachment.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                    >
                                      <span className="font-medium">{attachment.filename}</span>
                                      <span className="text-[11px] text-slate-400">
                                        {formatAttachmentSize(attachment.size)}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                        </section>

                        {canCollaborate ? (
                          <section className="border-t border-slate-200 pt-4">
                            <form onSubmit={handleSubmitUpdate} className="space-y-3">
                              <label className="block text-sm font-medium text-slate-700">
                                Add update
                                <textarea
                                  value={updateMessage}
                                  onChange={(event) => setUpdateMessage(event.target.value)}
                                  rows={4}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  placeholder="Share progress or actions taken..."
                                  required
                                />
                              </label>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-700">Attachments</p>
                                    <p className="text-[11px] text-slate-500">
                                      Optional · up to {MAX_ATTACHMENTS_PER_BATCH} files · 10 MB each
                                    </p>
                                  </div>
                                  <label
                                    className={clsx(
                                      "inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-400 px-3 py-1.5 text-xs font-semibold transition",
                                      attachmentLimitReached || isUploadingAttachment
                                        ? "cursor-not-allowed text-slate-400"
                                        : "text-slate-700 hover:border-slate-500 hover:bg-white"
                                    )}
                                  >
                                    <input
                                      type="file"
                                      multiple
                                      className="sr-only"
                                      onChange={handleAttachmentSelect}
                                      disabled={attachmentLimitReached || isUploadingAttachment}
                                    />
                                    {isUploadingAttachment
                                      ? "Uploading..."
                                      : attachmentLimitReached
                                        ? "Limit reached"
                                        : "Upload files"}
                                  </label>
                                </div>
                                {attachmentError ? (
                                  <p className="mt-2 text-[11px] font-medium text-rose-500">
                                    {attachmentError}
                                  </p>
                                ) : null}
                                {pendingAttachments.length > 0 ? (
                                  <ul className="mt-3 space-y-2 text-slate-700">
                                    {pendingAttachments.map((attachment) => (
                                      <li
                                        key={attachment.id}
                                        className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-xs shadow-sm"
                                      >
                                        <div>
                                          <p className="font-semibold">{attachment.filename}</p>
                                          <p className="text-[11px] text-slate-500">
                                            {formatAttachmentSize(attachment.size)} · {attachment.mimeType}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePendingAttachment(attachment.id)}
                                          className="text-rose-500 hover:text-rose-600"
                                        >
                                          Remove
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={addUpdateMutation.isPending || isUploadingAttachment}
                                  className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {addUpdateMutation.isPending ? "Posting..." : "Post update"}
                                </button>
                              </div>
                            </form>
                          </section>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                        Incident not found.
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}









