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
const PAGE_SIZE = 5;

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const sortedServices = useMemo(() => {
    if (!services) {
      return [];
    }
    return [...services].sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  const filteredServices = useMemo(() => {
    if (!search.trim()) {
      return sortedServices;
    }
    const query = search.trim().toLowerCase();
    return sortedServices.filter((service) => {
      const haystack = `${service.name} ${service.slug} ${service.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedServices, search]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedServices = filteredServices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
        <div className="border-b border-gray-200 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-gray-700">
            {isLoading ? "Loading services…" : `${filteredServices.length} services`}
          </div>
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search services"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {filteredServices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            {isLoading ? "No services yet." : "No services match that search."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Slug</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-center">Active incidents</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedServices.map((service) => (
                    <tr key={service.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                      <td className="px-4 py-3 text-gray-500">/{service.slug}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {service.description ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {service.activeIncidentCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:justify-between">
              <p>
                Showing {pagedServices.length} of {filteredServices.length}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
