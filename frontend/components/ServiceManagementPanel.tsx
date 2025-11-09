"use client";

import { useMemo, useState } from "react";
import type { ServiceRecord } from "@hooks/useServices";

type Props = {
  services?: ServiceRecord[];
  isLoading: boolean;
  onCreate: (payload: { name: string; description?: string | null }) => Promise<unknown>;
  onUpdate: (payload: { id: string; name?: string; description?: string | null }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isMutating: boolean;
};

const DEFAULT_FORM = {
  name: "",
  description: ""
};

export function ServiceManagementPanel({
  services,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isMutating
}: Props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedServices = useMemo(() => {
    if (!services) {
      return [];
    }
    return [...services].sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      if (editingId) {
        await onUpdate({
          id: editingId,
          name: form.name.trim(),
          description: form.description.trim() || null
        });
        setMessage("Service updated.");
      } else {
        await onCreate({
          name: form.name.trim(),
          description: form.description.trim() || null
        });
        setMessage("Service created.");
      }
      setForm(DEFAULT_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save service.");
    }
  };

  const handleEdit = (service: ServiceRecord) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description ?? ""
    });
    setMessage(null);
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setMessage(null);
  };

  const handleDelete = async (service: ServiceRecord) => {
    if (service.slug === "platform") {
      setError("The default platform service cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${service.name}? All incidents must be reassigned before deletion.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await onDelete(service.id);
      if (editingId === service.id) {
        handleCancel();
      }
      setMessage("Service deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete service.");
    }
  };

  const submitting = isMutating;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Service catalog</h3>
        <p className="text-sm text-gray-600">
          Define the services that appear on your public status page and link incidents directly to
          impacted systems.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Service name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Payments API"
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={submitting}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Short description
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Customer checkout traffic"
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={submitting}
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {editingId ? (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel edit
            </button>
          ) : (
            <span className="text-xs text-gray-500">Slugs are auto-generated from the name.</span>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : editingId ? "Save changes" : "Add service"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-600">{message}</p> : null}
      </form>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
          {isLoading ? "Loading services…" : `${sortedServices.length} services`}
        </div>
        <div className="divide-y divide-gray-100">
          {sortedServices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No services yet.</p>
          ) : (
            sortedServices.map((service) => (
              <div key={service.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{service.name}</p>
                  <p className="text-xs text-gray-500">
                    /{service.slug} • Active incidents: {service.activeIncidentCount}
                  </p>
                  {service.description ? (
                    <p className="text-xs text-gray-500">{service.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(service)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    disabled={submitting}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(service)}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    disabled={submitting || service.slug === "platform"}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
