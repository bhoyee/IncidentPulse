 "use client";

import Link from "next/link";
import { useStatusSubscribers } from "@hooks/useStatusSubscribers";

export default function StatusSubscribersPage() {
  const { state, refresh, remove } = useStatusSubscribers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-400">Status</p>
          <h1 className="text-2xl font-bold text-white">Status subscribers</h1>
          <p className="text-sm text-slate-400">
            Subscribers receive emails when incidents or maintenance change state.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Subscribers</h2>
          <button
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={refresh}
          >
            Refresh
          </button>
        </div>

        {state.status === "loading" && <p className="text-slate-300">Loading…</p>}
        {state.status === "error" && (
          <p className="text-rose-400">Failed to load: {state.message}</p>
        )}
        {state.status === "ready" && state.data.length === 0 && (
          <p className="text-slate-300">No subscribers yet.</p>
        )}

        {state.status === "ready" && state.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Services</th>
                  <th className="px-3 py-2">Verified</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((sub) => {
                  const svcIds =
                    Array.isArray(sub.serviceIds) && sub.serviceIds.length
                      ? (sub.serviceIds as string[]).join(", ")
                      : "All services";
                  return (
                    <tr key={sub.id} className="border-b border-slate-800/60">
                      <td className="px-3 py-2">{sub.email}</td>
                      <td className="px-3 py-2">{svcIds}</td>
                      <td className="px-3 py-2">
                        {sub.verifiedAt ? (
                          <span className="rounded bg-emerald-900/70 px-2 py-1 text-xs text-emerald-200">
                            Verified
                          </span>
                        ) : (
                          <span className="rounded bg-amber-900/60 px-2 py-1 text-xs text-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                          onClick={() => remove(sub.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
