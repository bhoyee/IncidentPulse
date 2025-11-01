"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
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
        header: "Title",
        cell: ({ row }) => (
          <div className="space-y-1">
            <span className="font-medium text-slate-800">{row.original.title}</span>
            {row.original.impactScope ? (
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {row.original.impactScope}
              </p>
            ) : null}
            {row.original.categories && row.original.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {row.original.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
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
          <span className="capitalize text-slate-600">{row.original.status}</span>
        )
      }
    ];

    if (isAdmin) {
      base.push({
        id: "reporter",
        header: "Reporter",
        accessorFn: (row) => row.createdBy?.name ?? "",
        cell: ({ row }) => (
          <span className="text-slate-600">{row.original.createdBy?.name ?? "Unknown"}</span>
        )
      });
    }

    base.push(
      {
        id: "assignee",
        header: "Assignee",
        accessorFn: (row) => row.assignedTo?.name ?? "",
        cell: ({ row }) => (
          <span className="text-slate-600">
            {row.original.assignedTo?.name ?? "Unassigned"}
          </span>
        )
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-slate-500">{formatRelative(row.original.updatedAt)}</span>
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

  if (incidents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No incidents yet. Everything looks good!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(event) => {
            table.resetPageIndex();
            setSearch(event.target.value);
          }}
          placeholder="Search by title, status, assignee, or category..."
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="text-xs text-slate-500">
          Showing {rows.length} of {table.getPrePaginationRowModel().rows.length} incidents
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1"
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
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-sm text-slate-500"
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
                    "cursor-pointer transition hover:bg-brand-50/40",
                    row.original.assignedToId === currentUserId ||
                      row.original.createdById === currentUserId
                      ? "bg-brand-50/30"
                      : ""
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
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
            className="rounded border border-slate-200 px-3 py-1 font-semibold transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-slate-200 px-3 py-1 font-semibold transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
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
    return <span aria-hidden="true">^</span>;
  }
  if (direction === "desc") {
    return <span aria-hidden="true">v</span>;
  }
  return <span className="text-slate-300" aria-hidden="true">-</span>;
}
