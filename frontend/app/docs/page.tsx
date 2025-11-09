"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import clsx from "clsx";
import {
  ArrowUpIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  GlobeAltIcon,
  UserGroupIcon,
  Cog8ToothIcon,
  ServerStackIcon,
  BoltIcon,
  CpuChipIcon,
  ClipboardDocumentCheckIcon,
  PaperClipIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const docSections = [
  { id: "overview", label: "Overview" },
  { id: "roles", label: "System Roles" },
  { id: "features", label: "Core Features" },
  { id: "architecture", label: "Architecture" },
  { id: "setup", label: "Setup Guide" },
  { id: "webhooks", label: "Webhook Automation" },
  { id: "api", label: "API Reference" },
  { id: "ui", label: "UI Guide" },
  { id: "faq", label: "FAQ" },
  { id: "credits", label: "Credits" }
] as const;

const overviewHighlights = [
  "Log incidents from monitoring tools, engineers, and customer reports without duplicating work.",
  "Coordinate responders with guided runbooks, assignments, and automated stakeholder updates.",
  "Publish a public status page that reads from the same dataset, keeping customers aligned."
];

const roleSummaries = [
  {
    role: "Admin",
    description:
      "Configures the platform, enforces governance, and provides leadership with holistic visibility.",
    capabilities: [
      "Define severity policies, SLAs, and incident templates.",
      "Manage integrations (PagerDuty, Slack, email, webhooks) and authentication providers.",
      "Brand and publish the public status site with service catalogs and regional overrides."
    ]
  },
  {
    role: "Operator",
    description:
      "Frontline responders who run playbooks, collaborate in the timeline, and keep stakeholders informed.",
    capabilities: [
      "Create and triage incidents with suggested severity and impacted services.",
      "Assign tasks, capture timeline updates, and coordinate with external teams.",
      "Request maintenance windows or policy adjustments from Admins when escalation is required."
    ]
  },
  {
    role: "Public",
    description:
      "Stakeholders, customers, or partners who consume the read-only status page and historical reports.",
    capabilities: [
      "Subscribe to relevant services for proactive notifications via email or RSS.",
      "Review current incident impact, remediation steps, and estimated resolution times.",
      "Access uptime history and post-incident summaries for contractual transparency."
    ]
  }
];

const roleMatrix = [
  { capability: "Create / triage incidents", admin: "Full", operator: "Full", publicUser: "No" },
  { capability: "Edit SLAs & playbooks", admin: "Full", operator: "Suggest", publicUser: "No" },
  { capability: "Publish status updates", admin: "Full", operator: "Full", publicUser: "Read" },
  { capability: "Manage team members", admin: "Full", operator: "No", publicUser: "No" },
  { capability: "View analytics & MTTR", admin: "Full", operator: "Full", publicUser: "Summary" },
  { capability: "Configure integrations", admin: "Full", operator: "Request", publicUser: "No" },
  { capability: "Brand public status site", admin: "Full", operator: "Request", publicUser: "No" }
];

const featureCards: Array<{
  title: string;
  description: string;
  highlights: string[];
  icon: IconComponent;
}> = [
  {
    title: "Incident Management",
    description:
      "Unify alert intake, manual reports, and automation triggers into a single prioritized queue.",
    highlights: [
      "Triage with severity templates, service impact tagging, and follow-up tasks.",
      "Link incidents to postmortems and problem records for continuous improvement.",
      "Enforced closure workflow requires root-cause analysis and resolution summaries before marking incidents resolved."
    ],
    icon: ShieldCheckIcon
  },
  {
    title: "Status Updates",
    description:
      "Keep stakeholders aligned with templated updates across email, Slack, and public channels.",
    highlights: [
      "Compose updates once and distribute across every channel with scheduling support.",
      "Auto-expire outdated posts and highlight customer-facing impact visually.",
      "Announce scheduled maintenance separately from incidents so customers know what to expect."
    ],
    icon: GlobeAltIcon
  },
  {
    title: "Service Catalog",
    description:
      "Model each customer-facing surface—website, APIs, data stores—and monitor them independently.",
    highlights: [
      "Admins define services with friendly names and descriptions; operators tag incidents to impacted services.",
      "Public status pages render per-service health states so customers instantly know what is degraded."
    ],
    icon: ServerStackIcon
  },
  {
    title: "Team Roles & Assignments",
    description:
      "Clarify ownership by assigning incident commanders, communications leads, and subject experts.",
    highlights: [
      "Role handoffs with acknowledgements prevent silent drops during shift changes.",
      "Escalation policies auto-notify backup owners to maintain coverage."
    ],
    icon: UserGroupIcon
  },
  {
    title: "SLA & Metrics Tracking",
    description:
      "Monitor MTTR, detection time, and customer impact with ready-to-share analytics dashboards.",
    highlights: [
      "Compare incident volume by service, severity, or root cause category.",
      "Export metrics to BI tools or share secure links with leadership."
    ],
    icon: ChartBarIcon
  },
  {
    title: "Evidence Attachments",
    description:
      "Give responders a single place to upload screenshots, HAR files, or log bundles alongside each timeline update.",
    highlights: [
      "Supports up to five files per update (10 MB each) stored inside the secure uploads directory defined by UPLOAD_DIR.",
      "Incident creation form also accepts optional evidence so triage starts with screenshots, HAR files, or log snippets already attached.",
      "Serve attachments through the backend /uploads gateway so reviewers can download or share artifacts without leaving the app."
    ],
    icon: PaperClipIcon
  },
  {
    title: "Public Status Page",
    description:
      "Deliver a trustworthy, branded status experience that reflects the latest internal truth.",
    highlights: [
      "Custom domains, regional scoping, and historical uptime badges build credibility.",
      "Allow visitors to filter by service and subscribe for real-time alerts.",
      "Show scheduled maintenance windows in advance without triggering outage states."
    ],
    icon: GlobeAltIcon
  },
  {
    title: "System Settings",
    description:
      "Govern identity providers, integrations, webhooks, and audit trails from a single control center.",
    highlights: [
      "Role-based access controls and SCIM keep user lifecycle in sync.",
      "Audit log export satisfies compliance and security review requirements."
    ],
    icon: Cog8ToothIcon
  }
];

const architectureFlows = [
  {
    title: "Frontend",
    description:
      "Next.js marketing site and authenticated dashboard deployed on Vercel with React Server Components for performance.",
    icon: BookOpenIcon
  },
  {
    title: "API Gateway",
    description:
      "Node/Express service hosted on Render exposes REST endpoints, handles auth, and orchestrates incident workflows.",
    icon: BoltIcon
  },
  {
    title: "Database",
    description:
      "PostgreSQL managed by Prisma migrations stores incidents, updates, user roles, and SLA policies with auditing.",
    icon: ServerStackIcon
  },
  {
    title: "Public Status",
    description:
      "Static, cache-friendly status site hydrated via incremental revalidation so customers always see accurate data.",
    icon: GlobeAltIcon
  }
];

const setupGuide = {
  prerequisites: [
    "Node.js 20+ and npm 10+ installed locally.",
    "Vercel account for hosting the Next.js frontend.",
    "Render (or any Node-compatible platform) for the backend API.",
    "PostgreSQL database (Render, Neon, Supabase, or self-managed)."
  ],
  local: [
    "git clone https://github.com/your-org/incident-pulse.git",
    "cp frontend/.env.local.example frontend/.env.local && update API base URLs.",
    "cd frontend && npm install",
    "cd backend && npm install && npx prisma migrate dev",
    "Set UPLOAD_DIR in backend/.env (defaults to uploads inside the backend folder) and ensure that directory exists so attachment uploads can be written.",
    "Run both apps: npm run dev inside frontend and backend directories."
  ],
  deployment: [
    "Push the repository to GitHub or GitLab with protected main branches.",
    "Connect Vercel to the repo, selecting the frontend directory, and configure environment variables (NEXT_PUBLIC_API_URL, AUTH_SECRET).",
    "Provision the backend on Render with build command npm install && npm run build and start command npm run start.",
    "Set DATABASE_URL, UPLOAD_DIR, and auth secrets on Render, then run npx prisma migrate deploy.",
    "If Render needs persistent evidence storage, point UPLOAD_DIR to an attached disk or cloud storage mount.",
    "Configure custom domains for the public status page and marketing site."
  ]
};

const apiEndpoints = [
  {
    method: "POST",
    path: "/auth/login",
    summary: "Authenticate with email and password to receive a session token.",
    request: `POST /auth/login
Content-Type: application/json

{
  "email": "oncall@example.com",
  "password": "super-secret"
}`,
    response: `200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123",
    "name": "Riley SRE",
    "role": "admin",
    "team": "Site Reliability"
  }
}`
  },
  {
    method: "GET",
    path: "/incidents",
    summary:
      "Return paginated incidents with optional filters for status, severity, owner, and impacted service.",
    request: `GET /incidents?status=active&severity=high
Accept: application/json`,
    response: `200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": "inc_481",
      "title": "Checkout latency spike",
      "severity": "high",
      "state": "investigating",
      "owner": "Alex Rivera",
      "opened_at": "2025-11-02T16:21:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 74
  }
}`
  },
  {
    method: "PATCH",
    path: "/incidents/:id",
    summary:
      "Update incident state, assignments, or post timeline entries. Requires operator or admin privileges.",
    request: `PATCH /incidents/inc_481
Content-Type: application/json

{
  "state": "mitigated",
  "assignee": "Jordan Lee",
  "timeline": [
    {
      "type": "update",
      "body": "Applied hotfix to rollback release 2025.11.02"
    }
  ]
}`,
    response: `200 OK
Content-Type: application/json

{
  "id": "inc_481",
  "state": "mitigated",
  "resolved_at": "2025-11-02T17:05:00.000Z",
      "timeline": [
        {
          "at": "2025-11-02T16:45:00.000Z",
          "body": "Applied hotfix to rollback release 2025.11.02",
          "author": "Jordan Lee"
        }
      ]
}`
  },
  {
    method: "POST",
    path: "/incidents/:id/attachments",
    summary:
      "Upload evidence files (screenshots, logs, HAR files) before posting an update. Limit five files per update, 10 MB each.",
    request: `POST /incidents/inc_481/attachments
Content-Type: multipart/form-data

file: outage-dashboard.png`,
    response: `201 Created
Content-Type: application/json

{
  "error": false,
  "data": {
    "id": "att_901",
    "filename": "outage-dashboard.png",
    "mimeType": "image/png",
    "size": 418204,
    "url": "/uploads/incidents/inc_481/outage-dashboard.png"
  }
}`
  },
  {
    method: "DELETE",
    path: "/incidents/:incidentId/attachments/:attachmentId",
    summary:
      "Remove a staged attachment before it is bound to a timeline update. Only admins or the original uploader can delete it.",
    request: `DELETE /incidents/inc_481/attachments/att_901`,
    response: `204 No Content`
  },
  {
    method: "POST",
    path: "/maintenance",
    summary:
      "Create a scheduled maintenance window (admin only). Planned downtime is announced separately from incidents.",
    request: `POST /maintenance
Content-Type: application/json

{
  "title": "Database maintenance",
  "description": "Upgrading storage tier. Read-only for 15 minutes.",
  "startsAt": "2025-11-10T01:00:00Z",
  "endsAt": "2025-11-10T01:15:00Z",
  "appliesToAll": false,
  "serviceId": "svc_db_primary"
}`,
    response: `201 Created
Content-Type: application/json

{
  "error": false,
  "data": {
    "id": "mnt_901",
    "status": "scheduled",
    "startsAt": "2025-11-10T01:00:00.000Z",
    "endsAt": "2025-11-10T01:15:00.000Z",
    "appliesToAll": false,
    "service": {
      "id": "svc_db_primary",
      "name": "Primary Database"
    }
  }
}`
  },
  {
    method: "GET",
    path: "/maintenance?window=upcoming",
    summary:
      "List upcoming and active maintenance windows. Use window=past for history or filter by serviceId.",
    request: `GET /maintenance?window=upcoming
Accept: application/json`,
    response: `200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": "mnt_901",
      "title": "Database maintenance",
      "status": "scheduled",
      "startsAt": "2025-11-10T01:00:00.000Z",
      "endsAt": "2025-11-10T01:15:00.000Z",
      "appliesToAll": false,
      "service": {
        "id": "svc_db_primary",
        "name": "Primary Database"
      }
    }
  ]
}`
  }
];

const webhookAlertSample = `POST /webhooks/incidents
Content-Type: application/json
X-Signature: <hex-hmac-from-WEBHOOK_HMAC_SECRET>

{
  "service": "checkout-api",
  "environment": "production",
  "eventType": "error_spike",
  "message": "500 errors exceeded 5% in the last 2 minutes",
  "severity": "high",
  "occurredAt": "2024-11-05T22:55:00Z",
  "fingerprint": "checkout-api|production|error_spike",
  "meta": {
    "errorCount": 324,
    "threshold": "5%"
  }
}`;

const webhookRecoverySample = `POST /webhooks/incidents/recovery
Content-Type: application/json
X-Signature: <hex-hmac-from-WEBHOOK_HMAC_SECRET>

{
  "fingerprint": "checkout-api|production|error_spike",
  "occurredAt": "2024-11-05T23:05:00Z",
  "meta": {
    "note": "Service restored automatically"
  }
}`;

const uiScreens = [
  {
    title: "Incident List",
    description:
      "Monitor active, recent, and scheduled incidents with severity badges, SLA burn-down, and quick assignment controls."
  },
  {
    title: "Incident Detail",
    description:
      "Timeline-first view with task checklists, linked runbooks, and collaboration tools for responders. Operators must capture root cause plus a resolution summary before the system allows closure."
  },
  {
    title: "Analytics",
    description:
      "Visualize MTTR trends, service reliability, on-call load distribution, and SLA adherence over time."
  },
  {
    title: "User Management",
    description:
      "Invite teammates, manage roles, enforce SSO, and review access history from a unified roster."
  },
  {
    title: "Webhooks & Integrations",
    description:
      "Left-rail admin console that surfaces alert and recovery endpoints, sample cURL snippets, secret handling guidance, and Slack or Telegram notification settings alongside quick links to documentation and the public status page."
  },
  {
    title: "Public Status Page",
    description:
      "Branded, cache-friendly status site with subscriptions, scheduled maintenance, and historical transparency."
  }
];

const faqItems = [
  {
    question: "Why can't I see every incident?",
    answer:
      "Operators only see incidents tied to their services or assignments. Ask an Admin to extend your service scope or grant temporary all-incident access when needed."
  },
  {
    question: "Why is my status page blank?",
    answer:
      "The public page only shows incidents marked as customer-impacting or scheduled maintenance. Confirm incidents have published updates and that cache invalidation has completed."
  },
  {
    question: "Where are evidence attachments stored?",
    answer:
      "The backend streams files into the directory referenced by UPLOAD_DIR (uploads/ by default, relative to the backend app) and serves them via the /uploads prefix. Point UPLOAD_DIR at persistent storage so artifacts survive restarts."
  },
  {
    question: "How do I enable Slack or Telegram notifications?",
    answer:
      "Admins can connect Slack or Teams under System Settings → Integrations. Provide the webhook URL, select channels, and enable incident triggers for creation, updates, and resolution."
  },
  {
    question: "Can I restore historical incidents for analytics?",
    answer:
      "Yes. Import CSV data or use the bulk API to seed legacy incidents. Run `npm run seed` in the backend to load sample data for demos."
  }
];

const credits = {
  license: "MIT License",
  owner: "Developed by the IncidentPulse team for demonstration and portfolio scenarios.",
  links: [
    { label: "Backend README", href: "https://github.com/your-org/incident-pulse/blob/main/README.md" },
    { label: "Report an issue", href: "mailto:team@incidentpulse.io" }
  ]
};

const mobileNavChevron = (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className="text-slate-400">
    <path d="M0 4h8M4 0v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function useActiveSection() {
  const [activeSection, setActiveSection] = useState<string>(docSections[0].id);

  useEffect(() => {
    const handler = () => {
      const offsets = docSections.map((section) => {
        const element = document.getElementById(section.id);
        if (!element) {
          return { id: section.id, distance: Number.POSITIVE_INFINITY };
        }
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - 160);
        return { id: section.id, distance };
      });
      const closest = offsets.reduce((prev, current) =>
        current.distance < prev.distance ? current : prev
      );
      setActiveSection(closest.id);
    };

    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return activeSection;
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-50"
    >
      <ArrowUpIcon className="h-4 w-4" aria-hidden="true" />
      Back to top
    </button>
  );
}

function FeatureIcon({ icon: Icon }: { icon: IconComponent }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
  );
}

function SectionBadge({ index, label }: { index: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
      <span className="font-mono text-[11px] text-blue-600">{String(index + 1).padStart(2, "0")}</span>
      {label}
    </span>
  );
}

function PermissionCell({ value }: { value: string }) {
  const tone =
    value === "Full"
      ? "bg-blue-50 text-blue-700"
      : value === "No"
        ? "bg-slate-100 text-slate-400"
        : "bg-amber-50 text-amber-700";

  return (
    <span
      className={clsx(
        "inline-flex w-full items-center justify-center rounded-full px-3 py-1 text-xs font-semibold",
        tone
      )}
    >
      {value}
    </span>
  );
}

function DocsPageNav({ activeSection }: { activeSection: string }) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Documentation</p>
        <h1 className="text-2xl font-semibold text-slate-900">IncidentPulse</h1>
        <p className="text-sm text-slate-600">
          Comprehensive product, platform, and integration guide for administrators and responders.
        </p>
      </div>
      <nav className="space-y-1 text-sm font-medium text-slate-600">
        {docSections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-blue-50 hover:text-blue-700",
              activeSection === section.id ? "bg-blue-50 text-blue-700 shadow-sm" : ""
            )}
          >
            <span className="font-mono text-[11px] text-slate-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{section.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function SetupCard({
  title,
  items,
  icon: Icon
}: {
  title: string;
  items: string[];
  icon: IconComponent;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">Follow these steps to stay productive.</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircleIcon className="mt-1 h-4 w-4 text-blue-500" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs text-slate-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function DocumentationPage() {
  const activeSection = useActiveSection();
  const nav = useMemo(() => <DocsPageNav activeSection={activeSection} />, [activeSection]);

  return (
    <>
      <div className="relative mx-auto w-full max-w-6xl px-4 py-16 lg:py-20">
        <div className="flex flex-col gap-12 lg:flex-row">
          <aside className="hidden w-full shrink-0 lg:block lg:w-64">{nav}</aside>
          <div className="flex-1 space-y-20">
            <div className="lg:hidden">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <BookOpenIcon
                    className="h-10 w-10 rounded-xl bg-blue-50 p-2 text-blue-600"
                    aria-hidden="true"
                  />
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                      IncidentPulse Documentation
                    </h1>
                    <p className="text-sm text-slate-600">
                      Browse the sections below or use the quick navigation chips.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {docSections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700",
                        activeSection === section.id ? "border-blue-300 bg-blue-50 text-blue-700" : ""
                      )}
                    >
                      {mobileNavChevron}
                      {section.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <section id="overview" className="scroll-mt-32 space-y-8">
              <SectionBadge index={0} label="What is IncidentPulse?" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">
                  Operational visibility from detection to public communication
                </h2>
                <p className="text-base text-slate-600">
                  IncidentPulse is an internal and public incident management platform that helps teams log outages,
                  coordinate responders, and communicate status transparently. It replaces spreadsheets and siloed tools
                  with a single system of record for incidents, teams, and customer-facing updates.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    The problem it solves
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Fragmented tooling slows response and frustrates customers. IncidentPulse centralizes detection,
                    response, and communication so every stakeholder sees the same truth.
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    {overviewHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircleIcon className="mt-1 h-4 w-4 text-blue-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Who should use it
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Designed for Admins, Operators, and Public stakeholders who need accountability and transparency.
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="font-semibold text-slate-800">Admin</p>
                      <p className="text-sm text-slate-600">
                        Platform owners orchestrating policy, integrations, and governance.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="font-semibold text-slate-800">Operator</p>
                      <p className="text-sm text-slate-600">
                        On-call responders executing playbooks and communicating progress.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="font-semibold text-slate-800">Public</p>
                      <p className="text-sm text-slate-600">
                        Customers, partners, or executives monitoring health and uptime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Incident flow at a glance
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Each incident moves through a connected lifecycle so no context is lost between teams.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  {[
                    { title: "Detect", description: "Alerts and monitors create an incident with auto severity." },
                    { title: "Coordinate", description: "Operators assign roles, run playbooks, and capture updates." },
                    {
                      title: "Communicate",
                      description: "Stakeholders receive timeline posts, email, and status page updates."
                    },
                    { title: "Learn", description: "Admins review analytics, publish postmortems, and refine SLAs." }
                  ].map((step) => (
                    <div
                      key={step.title}
                      className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        {step.title}
                      </div>
                      <p className="text-xs text-slate-600">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="roles" className="scroll-mt-32 space-y-8">
              <SectionBadge index={1} label="System Roles" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Role clarity accelerates response</h2>
                <p className="text-base text-slate-600">
                  Map responsibilities to clear permissions so the right people can act quickly without risking governance.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {roleSummaries.map((role) => (
                  <details
                    key={role.role}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    open
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 text-lg font-semibold text-slate-900">
                      <span>{role.role}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 group-open:bg-blue-100">
                        View details
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-slate-600">{role.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      {role.capabilities.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <ShieldCheckIcon className="mt-1 h-4 w-4 text-blue-500" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Capability</th>
                      <th className="px-4 py-3 text-center font-semibold">Admin</th>
                      <th className="px-4 py-3 text-center font-semibold">Operator</th>
                      <th className="px-4 py-3 text-center font-semibold">Public</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roleMatrix.map((entry) => (
                      <tr key={entry.capability}>
                        <td className="px-4 py-3 text-left text-slate-700">{entry.capability}</td>
                        <td className="px-4 py-3 text-center">
                          <PermissionCell value={entry.admin} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PermissionCell value={entry.operator} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PermissionCell value={entry.publicUser} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="features" className="scroll-mt-32 space-y-8">
              <SectionBadge index={2} label="Core Features" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Built for high-performing response teams</h2>
                <p className="text-base text-slate-600">
                  Each capability pairs a polished UI with deep operational workflows so you can launch quickly and scale with confidence.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {featureCards.map((feature) => (
                  <article
                    key={feature.title}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <FeatureIcon icon={feature.icon} />
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      {feature.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2">
                          <ClipboardDocumentCheckIcon
                            className="mt-1 h-4 w-4 text-blue-500"
                            aria-hidden="true"
                          />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-xs text-slate-500">
                      Placeholder for screenshot: pair this card with dashboard imagery highlighting {feature.title.toLowerCase()}.
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="architecture" className="scroll-mt-32 space-y-8">
              <SectionBadge index={3} label="Architecture" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Modern, resilient architecture</h2>
                <p className="text-base text-slate-600">
                  IncidentPulse separates marketing, operator, and public surfaces while sharing a secure core API and database.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-6 md:grid-cols-2">
                  {architectureFlows.map((item) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <item.icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  <svg viewBox="0 0 960 260" className="h-full w-full" role="img" aria-label="System data flow diagram">
                    <defs>
                      <linearGradient id="docGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1f7bff" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#1f7bff" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="40"
                      y="40"
                      width="200"
                      height="120"
                      rx="18"
                      fill="url(#docGradient)"
                      stroke="#1f7bff"
                      strokeOpacity="0.4"
                    />
                    <text x="140" y="90" textAnchor="middle" fontSize="16" fill="#0a2b66">
                      Frontend
                    </text>
                    <text x="140" y="114" textAnchor="middle" fontSize="12" fill="#334155">
                      Next.js + React
                    </text>

                    <rect
                      x="360"
                      y="40"
                      width="220"
                      height="120"
                      rx="18"
                      fill="#fff"
                      stroke="#1f7bff"
                      strokeOpacity="0.4"
                    />
                    <text x="470" y="86" textAnchor="middle" fontSize="16" fill="#0a2b66">
                      API
                    </text>
                    <text x="470" y="110" textAnchor="middle" fontSize="12" fill="#334155">
                      Node / Express
                    </text>

                    <rect
                      x="680"
                      y="40"
                      width="240"
                      height="120"
                      rx="18"
                      fill="#fff"
                      stroke="#1f7bff"
                      strokeOpacity="0.4"
                    />
                    <text x="800" y="86" textAnchor="middle" fontSize="16" fill="#0a2b66">
                      Database
                    </text>
                    <text x="800" y="110" textAnchor="middle" fontSize="12" fill="#334155">
                      PostgreSQL + Prisma
                    </text>

                    <rect
                      x="360"
                      y="180"
                      width="220"
                      height="60"
                      rx="14"
                      fill="#fff"
                      stroke="#1f7bff"
                      strokeOpacity="0.4"
                    />
                    <text x="470" y="214" textAnchor="middle" fontSize="14" fill="#0a2b66">
                      Public Status Page
                    </text>

                    <line
                      x1="240"
                      y1="100"
                      x2="360"
                      y2="100"
                      stroke="#1f7bff"
                      strokeWidth="2"
                      markerEnd="url(#arrowHead)"
                    />
                    <line
                      x1="580"
                      y1="100"
                      x2="680"
                      y2="100"
                      stroke="#1f7bff"
                      strokeWidth="2"
                      markerEnd="url(#arrowHead)"
                    />
                    <line
                      x1="470"
                      y1="160"
                      x2="470"
                      y2="180"
                      stroke="#1f7bff"
                      strokeWidth="2"
                      markerEnd="url(#arrowHead)"
                    />

                    <text x="300" y="88" textAnchor="middle" fontSize="12" fill="#1f7bff">
                      REST / React Query
                    </text>
                    <text x="630" y="88" textAnchor="middle" fontSize="12" fill="#1f7bff">
                      Prisma ORM
                    </text>
                    <text x="490" y="176" textAnchor="start" fontSize="12" fill="#1f7bff">
                      ISR + Cache
                    </text>

                    <defs>
                      <marker
                        id="arrowHead"
                        markerWidth="8"
                        markerHeight="8"
                        refX="4"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 z" fill="#1f7bff" />
                      </marker>
                    </defs>
                  </svg>
                </div>
              </div>
            </section>

            <section id="setup" className="scroll-mt-32 space-y-8">
              <SectionBadge index={4} label="Setup Guide" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Launch in minutes for demos or production</h2>
                <p className="text-base text-slate-600">
                  A streamlined developer experience keeps onboarding fast whether you are evaluating locally or deploying to the cloud.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <SetupCard title="Prerequisites" items={setupGuide.prerequisites} icon={CpuChipIcon} />
                <SetupCard title="Run locally" items={setupGuide.local} icon={BoltIcon} />
                <SetupCard title="Deploy" items={setupGuide.deployment} icon={ServerStackIcon} />
              </div>
            </section>

            <section id="webhooks" className="scroll-mt-32 space-y-8">
              <SectionBadge index={5} label="Webhook Automation" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Automate incident intake from observability tools</h2>
                <p className="text-base text-slate-600">
                  Connect monitoring platforms, scheduled jobs, or custom scripts to IncidentPulse. Alerts create or update incidents automatically,
                  while recovery events close them and notify the assigned operator.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Endpoints & authentication
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>
                      <strong className="font-semibold text-slate-800">POST /webhooks/incidents</strong> &ndash; create, dedupe, or escalate incidents.
                    </li>
                    <li>
                      <strong className="font-semibold text-slate-800">POST /webhooks/incidents/recovery</strong> &ndash; resolve the matching incident once service is healthy.
                    </li>
                    <li>
                      Sign requests with <code className="font-mono text-xs text-slate-500">X-Signature</code> (HMAC-SHA256 using <code className="font-mono text-xs text-slate-500">WEBHOOK_HMAC_SECRET</code>).
                      Trusted internal tools can fall back to <code className="font-mono text-xs text-slate-500">X-Webhook-Token</code>.
                    </li>
                    <li>
                      Support for <code className="font-mono text-xs text-slate-500">X-Idempotency-Key</code>, a 60 requests/minute rate limit per token, and a &plusmn;10 minute skew window on
                      <code className="font-mono text-xs text-slate-500">occurredAt</code> keeps integrations reliable.
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Environment variables
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>
                      <code className="font-mono text-xs text-slate-500">WEBHOOK_HMAC_SECRET</code> &ndash; required hex string used when calculating HMAC signatures. Generate it once (for example
                      <code className="ml-1 font-mono text-xs text-slate-500">openssl rand -hex 32</code>), store it in Render &rarr; Environment, and distribute it to downstream tools via your secrets manager &mdash; it is not displayed in the dashboard.
                    </li>
                    <li>
                      <code className="font-mono text-xs text-slate-500">WEBHOOK_SHARED_TOKEN</code> &ndash; optional bearer token for services that cannot sign requests.
                    </li>
                    <li>
                      <code className="font-mono text-xs text-slate-500">WEBHOOK_SYSTEM_USER_ID</code> &ndash; optional UUID of the automation account that should author webhook incidents.
                    </li>
                    <li>
                      Track adoption via <code className="font-mono text-xs text-slate-500">GET /metrics/webhook</code> (requires admin authentication).
                    </li>
                  </ul>


                  <p className="mt-4 text-xs text-slate-600">
                    Treat the HMAC secret like any other credential: rotate it from Render if compromised and share it with integrators through a secure channel (password vault, secret manager). Open the dashboard&rsquo;s{" "}
                    <span className="font-semibold text-slate-800">Webhooks &amp; Integrations</span> tab to copy the alert and recovery endpoints, grab ready-to-run cURL/Postman snippets, and wire up Slack or Telegram notifications. The panel reiterates
                    which secrets live in Render but intentionally never exposes the raw values to prevent leakage.
                  </p>

                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <CodeBlock label="Alert webhook request" value={webhookAlertSample} />
                <CodeBlock label="Recovery webhook request" value={webhookRecoverySample} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Platform behaviour
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>
                    Alerts dedupe on <code className="font-mono text-xs text-slate-500">fingerprint</code> for ten minutes while the incident is open; higher severity replays automatically escalate.
                  </li>
                  <li>
                    Recovery payloads resolve the open incident, set <code className="font-mono text-xs text-slate-500">resolvedAt</code>, and notify the assigned operator plus the incident timeline.
                  </li>
                  <li>
                    Admins are notified on creation, repeat alerts append timeline updates, and all interactions are included in audit logs.
                  </li>
                  <li>
                    Configure Slack and Telegram notifications from the dashboard&apos;s Webhooks tab once your HMAC secret is in place.
                  </li>
                  <li>
                    Need a refresher? Visit <Link href="/docs#webhooks" className="text-blue-600 underline">/docs#webhooks</Link> for Postman scripts, cURL examples, and troubleshooting tips.
                  </li>
                </ul>
              </div>
            </section>

            <section id="api" className="scroll-mt-32 space-y-8">
              <SectionBadge index={6} label="API Reference" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Developer-friendly REST API</h2>
                <p className="text-base text-slate-600">
                  Pair the API with React Query on the frontend or integrate with other systems for automation and reporting.
                </p>
              </div>
              <div className="space-y-6">
                {apiEndpoints.map((endpoint) => (
                  <article
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <header className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold uppercase tracking-wide text-white">
                        {endpoint.method}
                      </span>
                      <span className="font-mono text-sm text-slate-900">{endpoint.path}</span>
                      <span className="text-sm text-slate-500">- {endpoint.summary}</span>
                    </header>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <CodeBlock label="Request" value={endpoint.request} />
                      <CodeBlock label="Response" value={endpoint.response} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="ui" className="scroll-mt-32 space-y-8">
              <SectionBadge index={7} label="UI Guide" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Screens built for clarity</h2>
                <p className="text-base text-slate-600">
                  Showcase the experience in portfolios or internal onboarding with annotated screenshots and captions.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {uiScreens.map((screen) => (
                  <figure key={screen.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="h-40 rounded-xl border border-dashed border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50" />
                    <figcaption className="mt-4">
                      <h3 className="text-lg font-semibold text-slate-900">{screen.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">{screen.description}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <section id="faq" className="scroll-mt-32 space-y-8">
              <SectionBadge index={8} label="FAQ & Troubleshooting" />
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">Answers to common questions</h2>
                <p className="text-base text-slate-600">
                  Guide operators and admins through frequent blockers to keep the platform running smoothly.
                </p>
              </div>
              <div className="space-y-3">
                {faqItems.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <summary className="flex cursor-pointer items-start justify-between gap-3 text-lg font-semibold text-slate-900">
                      <span>{faq.question}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 group-open:bg-blue-50 group-open:text-blue-700">
                        Expand
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-slate-600">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section id="credits" className="scroll-mt-32 space-y-8">
              <SectionBadge index={9} label="Credits & License" />
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900">Open collaboration encouraged</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {credits.owner} Contributions, bug reports, and feature requests are welcome.
                </p>
                <dl className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">License:</span>
                    <span>{credits.license}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-semibold text-slate-700">Resources:</span>
                    {credits.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="inline-flex items-center gap-1 text-blue-600 underline"
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </dl>
              </div>
            </section>

            <footer className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircleIcon className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  Next steps
                </span>
                <span>
                  Ready to explore further? Jump into the{" "}
                  <Link href="/dashboard" className="text-blue-600 underline">
                    dashboard
                  </Link>{" "}
                  or{" "}
                  <Link href="/status" className="text-blue-600 underline">
                    public status page
                  </Link>{" "}
                  to see IncidentPulse in action.
                </span>
              </div>
            </footer>
          </div>
        </div>
      </div>
      <BackToTopButton />
    </>
  );
}
