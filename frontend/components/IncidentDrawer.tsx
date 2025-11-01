"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useIncidentDetail, useInvalidateIncidents } from "@hooks/useIncidents";
import { apiClient } from "@lib/api-client";
import { formatDate, formatRelative } from "@lib/format";
import type { IncidentStatus } from "@lib/types";
import { SeverityBadge } from "./SeverityBadge";
import type { TeamUser } from "@hooks/useTeamUsers";

type Props = {
  incidentId?: string;
  open: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    role: "admin" | "operator" | "viewer";
  };
  teamUsers?: TeamUser[];
};

type UpdatePayload = {
  message: string;
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
}>;

export function IncidentDrawer({ incidentId, open, onClose, currentUser, teamUsers = [] }: Props) {
  const { data, isLoading } = useIncidentDetail(incidentId);
  const invalidateIncidents = useInvalidateIncidents();
  const queryClient = useQueryClient();
  const [updateMessage, setUpdateMessage] = useState("");
  const [statusChangePending, setStatusChangePending] = useState<IncidentStatus | null>(null);
  const [assignmentChangePending, setAssignmentChangePending] = useState<string | null>(null);

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

  const canCollaborate =
    incident &&
    (isAdmin ||
      (currentUser.role === "operator" &&
        (incident.createdById === currentUser.id || incident.assignedToId === currentUser.id)));

  const handleStatusChange = (status: IncidentStatus) => {
    setStatusChangePending(status);
    updateIncidentMutation.mutate({ status });
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
    if (!updateMessage.trim()) {
      return;
    }
    addUpdateMutation.mutate({ message: updateMessage.trim() });
  };

  const statusButtons: IncidentStatus[] = ["open", "investigating", "monitoring", "resolved"];

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
                      </div>
                      <div className="flex items-center gap-2">
                        {incident ? <SeverityBadge severity={incident.severity} /> : null}
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
                          <h3 className="text-sm font-semibold text-slate-800">Description</h3>
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
                            Impact scope: {incident.impactScope ?? "Not specified"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Categories:{" "}
                            {incident.categories?.length
                              ? incident.categories.join(", ")
                              : "None"}
                          </div>
                          <div className="mt-4 text-xs text-slate-500">
                            First response:{" "}
                            {incident.firstResponseAt
                              ? formatRelative(incident.firstResponseAt)
                              : "Pending"}
                            {" - "}
                            Resolved:{" "}
                            {incident.resolvedAt ? formatRelative(incident.resolvedAt) : "Pending"}
                          </div>
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
                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={addUpdateMutation.isPending}
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
