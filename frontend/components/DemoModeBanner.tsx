"use client";

import Link from "next/link";
import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { useSession } from "@hooks/useSession";

export function DemoModeBanner() {
  const { data: session } = useSession();

  if (!session?.isDemo) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="mx-auto flex w-full flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-12">
        <div className="flex items-start gap-2">
          <MegaphoneIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p>
            You are exploring the hosted <strong>read-only demo</strong>. Create your own deployment or log in with a
            non-demo account to test write operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/docs"
            className="text-sm font-medium text-amber-900 underline decoration-dotted underline-offset-4 hover:text-amber-700"
          >
            Self-host guide
          </Link>
          <a
            href="https://github.com/bhoyee/IncidentPulse"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-amber-900 underline decoration-dotted underline-offset-4 hover:text-amber-700"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
