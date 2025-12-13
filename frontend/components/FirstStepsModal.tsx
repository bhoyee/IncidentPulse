"use client";

import { useState } from "react";
import { XMarkIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/solid";

type Step = {
  title: string;
  bullets: string[];
};

const steps: Step[] = [
  {
    title: "Create your workspace",
    bullets: ["Confirm org name & slug", "Review plan limits for this org"]
  },
  {
    title: "Add your services",
    bullets: ["Add API/Web/DB entries", "Keep names clear; slugs power status URLs"]
  },
  {
    title: "Invite your team",
    bullets: ["Send invites with roles (admin/operator/viewer)", "They accept via email/link"]
  },
  {
    title: "Wire automation",
    bullets: ["Configure webhooks/API key for create/recover", "Set HMAC/shared token"]
  },
  {
    title: "Test & publish",
    bullets: ["Create and resolve a test incident", "Open /status/[slug] and share the link"]
  }
];

export function FirstStepsModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  if (!open) return null;

  const current = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">First 5 Steps</p>
            <h3 className="text-xl font-semibold text-white">Get you running</h3>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-slate-400 transition hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{current.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                {current.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Step {index + 1} of {steps.length}</span>
            <button
              onClick={onClose}
              className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
            >
              Skip for now
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <button
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
            disabled={index === 0}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                onClick={() => setIndex((prev) => Math.min(steps.length - 1, prev + 1))}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Next
              </button>
            )}
            {isLast && (
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
