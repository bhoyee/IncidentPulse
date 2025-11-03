"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { isAxiosError } from "axios";
import {
  useCreateTeamUser,
  useUpdateTeamUser,
  useDeleteTeamUser,
  type TeamUser,
  type UpdateUserPayload
} from "@hooks/useTeamUsers";

type TeamUsersMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Props = {
  id?: string;
  users: TeamUser[];
  meta?: TeamUsersMeta;
  isLoading: boolean;
  isRefetching: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
};

type LastCreatedSummary = {
  name: string;
  email: string;
  password: string | null;
};

const ROLE_OPTIONS: Array<TeamUser["role"]> = ["admin", "operator", "viewer"];

type FormState = {
  name: string;
  email: string;
  role: TeamUser["role"];
  teamRolesText: string;
  isActive: boolean;
  password: string;
};

const DEFAULT_FORM_STATE: FormState = {
  name: "",
  email: "",
  role: "operator",
  teamRolesText: "",
  isActive: true,
  password: ""
};

export function TeamManagementPanel({
  id,
  users,
  meta,
  isLoading,
  isRefetching,
  search,
  onSearchChange,
  page,
  onPageChange,
  pageSize
}: Props) {
  const createUser = useCreateTeamUser();
  const updateUser = useUpdateTeamUser();
  const deleteUser = useDeleteTeamUser();

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<LastCreatedSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchValue, setSearchValue] = useState(search ?? "");

  useEffect(() => {
    setSearchValue(search ?? "");
  }, [search]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const total = meta?.total ?? users.length;
  const totalPages = meta?.totalPages ?? Math.max(Math.ceil(total / Math.max(pageSize, 1)), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const rangeStart = users.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd =
    users.length === 0 ? 0 : Math.min(total, rangeStart + users.length - 1);

  const handleSearchInputChange = (value: string) => {
    setSearchValue(value);
    const currentSearch = search ?? "";
    if (value !== currentSearch) {
      onSearchChange(value);
      if (currentPage !== 1) {
        onPageChange(1);
      }
    }
  };

  const handlePageChange = (nextPage: number) => {
    const target = Math.min(Math.max(nextPage, 1), totalPages);
    if (target !== currentPage) {
      onPageChange(target);
    }
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const rawRoles = form.teamRolesText
      .split(",")
      .map((role) => role.trim())
      .filter((role) => role.length > 0);
    const invalidRoles = rawRoles.filter((role) => role.length < 2);
    const uniqueRoles = Array.from(new Set(rawRoles));

    if (!name || !email) {
      setFormError("Name and email are required.");
      return;
    }

    if (invalidRoles.length > 0) {
      setFormError("Team role labels must be at least 2 characters long.");
      return;
    }

    if (password && password.length < 10) {
      setFormError("Custom passwords must be at least 10 characters long.");
      return;
    }

    try {
      const result = await createUser.mutateAsync({
        name,
        email,
        role: form.role,
        isActive: form.isActive,
        teamRoles: uniqueRoles,
        ...(password ? { password } : {})
      });

      setLastCreated({
        name: result.data.name,
        email: result.data.email,
        password: result.meta.initialPassword ?? (password || null)
      });
      setCopied(false);
      setForm(DEFAULT_FORM_STATE);
      if (currentPage !== 1) {
        onPageChange(1);
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to create teammate. Please try again."
      );
    }
  };

  const handleCopyPassword = async () => {
    if (!lastCreated?.password) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopied(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(lastCreated.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const busy = isLoading || isRefetching || updateUser.isPending || createUser.isPending;

  return (
    <div
      id={id}
      className="space-y-4 rounded-3xl border border-white/15 bg-white/80 p-6 text-slate-900 shadow-xl backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Team management</h3>
          <p className="text-xs text-slate-500">
            Invite teammates, manage permissions, and organise on-call roles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {busy ? <span className="text-indigo-600">Syncing...</span> : null}
          <button
            type="button"
            onClick={() => setIsCreating((prev) => !prev)}
            disabled={createUser.isPending}
            className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Close form" : "New teammate"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex-grow text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
          <input
            type="search"
            value={searchValue}
            onChange={(event) => handleSearchInputChange(event.target.value)}
            placeholder="Search by name, email, or team role"
            className="mt-1 w-full rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <div className="text-xs text-slate-500">
          Showing {rangeStart}-{rangeEnd} of {total} teammates
        </div>
      </div>

      {searchValue.trim().length > 0 && searchValue.trim().length < 2 ? (
        <p className="text-xs text-slate-400">
          Enter at least 2 characters to filter results.
        </p>
      ) : null}

      {lastCreated ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">
            {lastCreated.name} ({lastCreated.email}) is ready to sign in.
          </p>
          {lastCreated.password ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-white px-2 py-1 font-mono text-xs text-emerald-700 shadow">
                {lastCreated.password}
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                {copied ? "Copied!" : "Copy password"}
              </button>
              <span className="text-xs text-emerald-700">
                Share this one-time password with the teammate.
              </span>
            </div>
          ) : (
            <p className="mt-2 text-xs">
              You supplied a custom password - share it directly with the teammate.
            </p>
          )}
        </div>
      ) : null}

      {createUser.isError ? (
        <p className="text-xs text-red-600">
          {createUser.error instanceof Error
            ? createUser.error.message
            : "Failed to create teammate."}
        </p>
      ) : null}

      {updateUser.isError ? (
        <p className="text-xs text-red-600">
          {updateUser.error instanceof Error
            ? updateUser.error.message
            : "Failed to update teammate details."}
        </p>
      ) : null}

      {isCreating ? (
        <form
          onSubmit={handleCreateSubmit}
          className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full name
              <input
                type="text"
                value={form.name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }));
                  setFormError(null);
                }}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, email: event.target.value }));
                  setFormError(null);
                }}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    role: event.target.value as TeamUser["role"]
                  }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Team roles
              <input
                type="text"
                value={form.teamRolesText}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, teamRolesText: event.target.value }));
                  setFormError(null);
                }}
                placeholder="ops, writer, support"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Custom password (optional)
            <input
              type="password"
              value={form.password}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, password: event.target.value }));
                setFormError(null);
              }}
              placeholder="Leave blank to auto-generate"
              minLength={10}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          {formError ? (
            <p className="text-xs text-red-600">{formError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Team roles are optional tags for filtering (comma separated, minimum 2 characters each).
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
            onClick={() => {
              setForm(DEFAULT_FORM_STATE);
              setFormError(null);
            }}
            className="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={createUser.isPending}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createUser.isPending ? "Creating..." : "Create teammate"}
          </button>
        </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/70 shadow-inner backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm">
            <thead className="bg-white/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Role</th>
                <th className="px-3 py-3 text-left">Team roles</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 bg-white/80">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Loading teammates...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    No teammates match your filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <TeamMemberRow
                    key={user.id}
                    user={user}
                    onSave={updateUser.mutateAsync}
                    onDelete={deleteUser.mutateAsync}
                    isGlobalSaving={updateUser.isPending}
                    isGlobalDeleting={deleteUser.isPending}
                    deletingUserId={
                      typeof deleteUser.variables === "string" ? deleteUser.variables : undefined
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="rounded border border-slate-200 px-3 py-1 font-semibold transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="rounded border border-slate-200 px-3 py-1 font-semibold transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

type TeamMemberRowProps = {
  user: TeamUser;
  onSave: (variables: { id: string; payload: UpdateUserPayload }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isGlobalSaving: boolean;
  isGlobalDeleting: boolean;
  deletingUserId?: string;
};

function TeamMemberRow({
  user,
  onSave,
  onDelete,
  isGlobalSaving,
  isGlobalDeleting,
  deletingUserId
}: TeamMemberRowProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<TeamUser["role"]>(user.role);
  const [teamRolesText, setTeamRolesText] = useState(user.teamRoles.join(", "));
  const [isActive, setIsActive] = useState(user.isActive);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    setEmail(user.email);
  }, [user.email]);

  useEffect(() => {
    setRole(user.role);
  }, [user.role]);

  useEffect(() => {
    setIsActive(user.isActive);
  }, [user.isActive]);

  useEffect(() => {
    setTeamRolesText(user.teamRoles.join(", "));
  }, [user.teamRoles]);

  const normalizedTeamRoles = useMemo(
    () =>
      teamRolesText
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [teamRolesText]
  );

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const invalidRoles = normalizedTeamRoles.some((item) => item.length < 2);
  const invalidName = trimmedName.length < 2;
  const invalidEmail =
    trimmedEmail.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const isRowDeleting = isGlobalDeleting && deletingUserId === user.id;

  const hasChanges =
    trimmedName !== user.name ||
    trimmedEmail !== user.email ||
    role !== user.role ||
    isActive !== user.isActive ||
    normalizedTeamRoles.join(",") !== user.teamRoles.join(",");

  const canSave =
    hasChanges && !invalidRoles && !invalidName && !invalidEmail && !isSaving && !isGlobalSaving && !isRowDeleting;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    const payload: UpdateUserPayload = {};

    if (trimmedName !== user.name) {
      payload.name = trimmedName;
    }
    if (trimmedEmail !== user.email) {
      payload.email = trimmedEmail;
    }
    if (role !== user.role) {
      payload.role = role;
    }
    if (isActive !== user.isActive) {
      payload.isActive = isActive;
    }
    if (normalizedTeamRoles.join(",") !== user.teamRoles.join(",")) {
      payload.teamRoles = Array.from(new Set(normalizedTeamRoles));
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ id: user.id, payload });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsActive(user.isActive);
    setTeamRolesText(user.teamRoles.join(", "));
  };

  const handleDelete = async () => {
    if (isRowDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${user.name}'s account? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await onDelete(user.id);
    } catch (error) {
      let message = "Failed to delete user.";
      if (isAxiosError(error)) {
        message = error.response?.data?.message ?? error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      window.alert(message);
    }
  };

  return (
    <tr
      className={clsx(
        "transition hover:bg-indigo-50/70",
        user.isActive ? "bg-white/90" : "bg-slate-100 text-slate-400"
      )}
    >
      <td className="px-3 py-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving || isGlobalSaving || isRowDeleting}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {invalidName ? (
          <p className="mt-1 text-xs text-red-500">Name must be at least 2 characters.</p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSaving || isGlobalSaving || isRowDeleting}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {invalidEmail ? (
          <p className="mt-1 text-xs text-red-500">Enter a valid email address.</p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as TeamUser["role"])}
          disabled={isSaving || isGlobalSaving || isRowDeleting}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          type="text"
          value={teamRolesText}
          onChange={(event) => setTeamRolesText(event.target.value)}
          disabled={isSaving || isGlobalSaving || isRowDeleting}
          placeholder="ops, writer, support"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {invalidRoles ? (
          <p className="mt-1 text-xs text-red-500">
            Roles must be at least 2 characters.
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <select
          value={isActive ? "active" : "inactive"}
          onChange={(event) => setIsActive(event.target.value === "active")}
          disabled={isSaving || isGlobalSaving || isRowDeleting}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || isSaving || isGlobalSaving || isRowDeleting}
            className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isRowDeleting || isSaving || isGlobalSaving}
            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRowDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </td>
    </tr>
  );
}
