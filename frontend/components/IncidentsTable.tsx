"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  MagnifyingGlassIcon,
  ArrowSmallDownIcon,
  ArrowSmallUpIcon,
  ArrowsUpDownIcon
} from "@heroicons/react/24/outline";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import { formatRelative } from "@lib/format";
import type { Incident } from "@lib/types";
import { SeverityBadge } from "./SeverityBadge";

type Props = {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
  currentUserId: string;
  isAdmin: boolean;
};

const statusStyles: Record<Incident["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  investigating: "bg-indigo-100 text-indigo-700",
  monitoring: "bg-sky-100 text-sky-700",
  resolved: "bg-emerald-100 text-emerald-700"
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function IncidentsTable({ incidents, onSelect, currentUserId, isAdmin }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    if (!search) {
      return incidents;
    }
    const term = search.toLowerCase();
    return incidents.filter((incident) => {
      const categories = incident.categories ?? [];
      const assignedName = incident.assignedTo?.name?.toLowerCase() ?? "";
      const reporterName = incident.createdBy?.name?.toLowerCase() ?? "";
      return (
        incident.title.toLowerCase().includes(term) ||
        incident.status.toLowerCase().includes(term) ||
        incident.severity.toLowerCase().includes(term) ||
        incident.description.toLowerCase().includes(term) ||
        assignedName.includes(term) ||
        reporterName.includes(term) ||
        categories.some((category) => category.toLowerCase().includes(term)) ||
        (incident.impactScope ? incident.impactScope.toLowerCase().includes(term) : false)
      );
    });
  }, [incidents, search]);

  const columns = useMemo<ColumnDef<Incident>[]>(() => {
    const base: ColumnDef<Incident>[] = [
      {
        id: "title",
        header: "Incident",
        cell: ({ row }) => (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">{row.original.title}</p>
            {row.original.impactScope ? (
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                {row.original.impactScope}
              </p>
            ) : null}
            {row.original.categories && row.original.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {row.original.categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
                  >
                    {category}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )
      },
      {
        id: "severity",
        header: "Severity",
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
              statusStyles[row.original.status]
            )}
          >
            {row.original.status}
          </span>
        )
      }
    ];

    if (isAdmin) {
      base.push({
        id: "reporter",
        header: "Reporter",
        accessorFn: (row) => row.createdBy?.name ?? "",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-700">
              {row.original.createdBy?.name ?? "Unknown reporter"}
            </p>
            {row.original.createdBy?.email ? (
              <p className="text-xs text-slate-400">{row.original.createdBy.email}</p>
            ) : null}
          </div>
        )
      });
    }

    base.push(
      {
        id: "assignee",
        header: "Assignee",
        accessorFn: (row) => row.assignedTo?.name ?? "",
        cell: ({ row }) => {
          const assignee = row.original.assignedTo;
          const initials = assignee?.name ? getInitials(assignee.name) : "–";
          return (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/5 text-sm font-semibold text-slate-600">
                {assignee?.name ? initials : "—"}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {assignee?.name ?? "Unassigned"}
                </p>
                <p className="text-xs text-slate-400">
                  {assignee?.teamRoles?.length
                    ? assignee.teamRoles.join(", ")
                    : assignee?.role ?? "Awaiting owner"}
                </p>
              </div>
            </div>
          );
        }
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">{formatRelative(row.original.updatedAt)}</span>
        )
      }
    );

    return base;
  }, [isAdmin]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  const rows = table.getRowModel().rows;
  const pagination = table.getState().pagination;
  const totalFiltered = table.getPrePaginationRowModel().rows.length;
  const rangeStart =
    totalFiltered === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const rangeEnd =
    totalFiltered === 0 ? 0 : Math.min(totalFiltered, rangeStart + rows.length - 1);
  const totalIncidents = incidents.length;

  if (incidents.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/70 p-12 text-center text-sm text-slate-500 shadow-inner backdrop-blur">
        No incidents yet. Everything looks good!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              table.resetPageIndex();
              setSearch(event.target.value);
            }}
            placeholder="Search by title, status, assignee, or category..."
            className="w-full rounded-full border border-slate-200 bg-white/90 px-10 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-600">
            {totalIncidents} total
          </span>
          <span className="text-slate-400">
            Showing {rangeStart || 0}-{rangeEnd} of {totalFiltered} filtered
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/85 shadow-2xl backdrop-blur">
        <table className="min-w-full divide-y divide-slate-200/70">
          <thead className="bg-white/40 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 text-slate-500 transition hover:text-indigo-600"
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        <SortIndicator direction={header.column.getIsSorted()} />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200/70 text-sm">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-10 text-center text-sm text-slate-500"
                >
                  No incidents match your filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.original)}
                  className={clsx(
                    "cursor-pointer transition hover:bg-indigo-50/80",
                    row.original.assignedToId === currentUserId ||
                      row.original.createdById === currentUserId
                      ? "bg-indigo-50/40"
                      : "bg-white/80"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-4 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") {
    return <ArrowSmallUpIcon className="h-4 w-4 text-indigo-500" aria-hidden="true" />;
  }
  if (direction === "desc") {
    return <ArrowSmallDownIcon className="h-4 w-4 text-indigo-500" aria-hidden="true" />;
  }
  return <ArrowsUpDownIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />;
}
