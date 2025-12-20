import React from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

async function fetchEmbed(slug: string) {
  const res = await fetch(`${API_BASE}/public/status/embed?orgSlug=${encodeURIComponent(slug)}`, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to load status");
  }
  return res.json() as Promise<{
    error: boolean;
    data: {
      status: {
        overall_state: string;
        services: Array<{ id: string; name: string; state: string }>;
        active_incidents: Array<{
          id: string;
          title: string;
          severity: string;
          status: string;
          startedAt: string;
        }>;
      };
      meta: { state: string; uptime24h: number | null };
      branding: {
        embedEnabled: boolean;
        logoUrl: string | null;
        primaryColor: string | null;
        textColor: string | null;
        backgroundColor: string | null;
      };
    };
  }>;
}

export default async function StatusEmbedPage({ params }: { params: { slug: string } }) {
  const payload = await fetchEmbed(params.slug);
  const { status, branding } = payload.data;

  if (!branding.embedEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-4 text-center">
          <p className="text-sm font-semibold">Status embed is disabled for this tenant.</p>
        </div>
      </div>
    );
  }

  const bg = branding.backgroundColor || "#0f172a";
  const fg = branding.textColor || "#e2e8f0";
  const accent = branding.primaryColor || "#22c55e";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: bg, color: fg, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800/80 bg-slate-900/80 shadow-xl p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          {branding.logoUrl ? <img src={branding.logoUrl} alt="Status logo" className="h-10 w-auto" /> : null}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <h1 className="text-xl font-bold" style={{ color: fg }}>
              {status.overall_state?.replace("_", " ").toUpperCase()}
            </h1>
          </div>
          <span
            className="ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: `${accent}22`, color: accent }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
            {status.overall_state}
          </span>
        </div>

        <div className="grid gap-4 pt-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: fg }}>
              Active incidents
            </h2>
            {status.active_incidents.length === 0 ? (
              <p className="text-sm text-slate-400">No active incidents.</p>
            ) : (
              status.active_incidents.map((inc) => (
                <div key={inc.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <p className="text-sm font-semibold" style={{ color: fg }}>
                    {inc.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {inc.severity} · {inc.status} · {new Date(inc.startedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: fg }}>
              Services
            </h2>
            <div className="grid gap-2">
              {status.services.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                  style={{ color: fg }}
                >
                  <span className="text-sm font-medium">{svc.name}</span>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    {svc.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
