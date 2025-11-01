"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { IncidentSeverity } from "@lib/types";
import { useInvalidateIncidents } from "@hooks/useIncidents";

type FormState = {
  title: string;
  severity: IncidentSeverity;
  description: string;
  assignedToId: string | null;
  impactScope: string;
  categoriesText: string;
};

const defaultState: FormState = {
  title: "",
  severity: "medium",
  description: "",
  assignedToId: null,
  impactScope: "",
  categoriesText: ""
};

type Props = {
  disabled?: boolean;
  canAssign?: boolean;
  assignees?: Array<{
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
    teamRoles: string[];
    isActive: boolean;
  }>;
  currentUserId: string;
};

export function NewIncidentForm({ disabled, canAssign = false, assignees = [], currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    ...defaultState,
    assignedToId: canAssign ? null : currentUserId
  });
  const invalidateIncidents = useInvalidateIncidents();

  const mutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const categories =
        payload.categoriesText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean) ?? [];
      const response = await apiClient.post("/incidents", {
        title: payload.title,
        severity: payload.severity,
        description: payload.description,
        ...(payload.impactScope ? { impactScope: payload.impactScope } : {}),
        ...(categories.length > 0 ? { categories } : {}),
        ...(canAssign ? { assignedToId: payload.assignedToId ?? undefined } : {})
      });
      return response.data;
    },
    onSuccess: async () => {
      setForm({
        ...defaultState,
        assignedToId: canAssign ? null : currentUserId
      });
      setOpen(false);
      await invalidateIncidents();
    }
  });

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "assignedToId"
          ? value === "unassigned"
            ? null
            : value
          : value
    }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div
      id="new-incident"
      className="rounded-3xl border border-white/15 bg-white/80 p-6 shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Create incident</h3>
          <p className="text-xs text-slate-500">Log a new customer-facing disruption.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          {open ? "Close" : "New incident"}
        </button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Severity
              <select
                name="severity"
                value={form.severity}
                onChange={handleChange}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            {canAssign ? (
              <label className="block text-sm font-medium text-slate-700">
                Assign to
              <select
                name="assignedToId"
                value={form.assignedToId ?? "unassigned"}
                onChange={handleChange}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="unassigned">Unassigned</option>
                {assignees
                  .filter((user) => user.isActive)
                  .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.teamRoles.join(", ") || user.role})
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea
                name="description"
                rows={4}
                value={form.description}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Summarize the customer impact and scope."
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Impact scope
              <input
                type="text"
                name="impactScope"
                value={form.impactScope}
                onChange={handleChange}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g. Payments, On-call rotation"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Categories
              <input
                type="text"
                name="categoriesText"
                value={form.categoriesText}
                onChange={handleChange}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Comma separated (api, billing, comms)"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {mutation.isPending ? "Creating..." : "Create incident"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

