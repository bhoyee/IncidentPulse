// use client
// use client
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

type Props = {
  searchParams: { token?: string };
};

export default function VerifyStatusSubscription({ searchParams }: Props) {
  const token = searchParams?.token;
  const [state, setState] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState<string>(
    token ? "Verifying..." : "Missing token"
  );
  const didRun = useRef(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [branding, setBranding] = useState<{
    statusLogoUrl?: string | null;
    statusPrimaryColor?: string | null;
    statusTextColor?: string | null;
    statusBackgroundColor?: string | null;
  } | null>(null);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    const run = async () => {
      if (!token) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE || ""}/public/status/verify?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok && json && json.error === false) {
          setState("success");
          setMessage("Subscription verified. You will receive status updates.");
          setOrgName(json.orgName ?? null);
          setOrgSlug(json.orgSlug ?? null);
          if (json.branding) setBranding(json.branding);
        } else {
          setState("error");
          setMessage(json?.message || "Invalid or expired token.");
        }
      } catch {
        setState("error");
        setMessage("Could not verify subscription.");
      }
    };
    run();
  }, [token]);

  const bg = branding?.statusBackgroundColor || "#0f172a";
  const fg = branding?.statusTextColor || "#e2e8f0";
  const accent = branding?.statusPrimaryColor || "#22c55e";
  const logo = branding?.statusLogoUrl || null;
  const statusLink = orgSlug ? `/status/${orgSlug}` : "/status";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: bg, color: fg }}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800/60 bg-black/30 p-8 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-4 mb-6">
          {logo ? (
            <div className="relative h-24 w-24 rounded-2xl overflow-hidden bg-white/10">
              <Image src={logo} alt="logo" fill className="object-contain" />
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-70">
              Status subscription
            </p>
            <h1 className="text-2xl font-bold">
              {orgName ?? "Status updates"}
            </h1>
          </div>
        </div>

        <div
          className="rounded-xl border px-4 py-3 text-sm font-semibold"
          style={{
            background: state === "success" ? accent : state === "error" ? "#b91c1c" : "#1f2937",
            color: state === "success" || state === "error" ? "#0b1727" : fg,
            borderColor: "rgba(255,255,255,0.08)"
          }}
        >
          {message}
        </div>

        <div className="mt-4">
          {state === "success" ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-100">
              Verified
            </div>
          ) : state === "error" ? (
            <div className="rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-100">
              Verification failed
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">
              Checking...
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={statusLink}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold hover:border-slate-400"
            style={{ color: fg }}
          >
            View status page
          </a>
        </div>

        <div className="mt-6 text-center text-xs opacity-70">Powered by IncidentPulse</div>
      </div>
    </div>
  );
}
