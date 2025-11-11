"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  GlobeAltIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  ClockIcon,
  UserGroupIcon,
  PaperClipIcon
} from "@heroicons/react/24/outline";
import { StatusBanner } from "@components/StatusBanner";
import { PublicIncidentCard } from "@components/PublicIncidentCard";
import { useStatus } from "@hooks/useStatus";
import { useSession } from "@hooks/useSession";

const heroHighlights = [
  "Enterprise-grade incident management",
  "Real-time status monitoring",
  "Seamless team collaboration"
];

const featureCards = [
  {
    title: "Unified Incident Intake",
    description:
      "Centralize alerts from GitHub Actions, monitoring tools, and operator reports into one prioritized queue.",
    icon: BoltIcon
  },
  {
    title: "Transparent Communication",
    description:
      "Publish customer-facing status updates straight from the same data responders see. No more copy/paste.",
    icon: GlobeAltIcon
  },
  {
    title: "Operational Intelligence",
    description:
      "Track MTTR, response times, service impact, and responder load with built-in analytics and uptime snapshots.",
    icon: ChartBarIcon
  },
  {
    title: "Evidence & Attachments",
    description:
      "Collect screenshots, HAR files, and log bundles against each incident or update to keep the forensic trail intact.",
    icon: PaperClipIcon
  },
  {
    title: "Automation-Ready Webhooks",
    description:
      "Secure HMAC endpoints with dedupe/recovery logic plus templates for GitHub Actions, UptimeRobot, Datadog, and more.",
    icon: ArrowPathIcon
  },
  {
    title: "Audit & Compliance",
    description:
      "Full audit log of logins, assignments, maintenance events, and resolution notes for SOC2-ready transparency.",
    icon: ShieldCheckIcon
  }
];

const workflowSteps = [
  {
    title: "Detect and Scope",
    description:
      "Log incidents instantly with automated severity assessment and impact analysis for clear communication.",
    icon: ShieldCheckIcon
  },
  {
    title: "Coordinate Response",
    description:
      "Assign responders, track progress, and maintain timeline updates within a unified dashboard.",
    icon: ArrowPathIcon
  },
  {
    title: "Communicate Effectively",
    description:
      "Push curated updates to stakeholders and public status pages with one-click publishing.",
    icon: SparklesIcon
  }
];

const stats = [
  { label: "Self-host setup", value: "<10 min" },
  { label: "Status modules", value: "4" },
  { label: "Webhook templates", value: "6+" },
  { label: "Audit coverage", value: "100%" }
];

const platformHighlights = [
  {
    title: "Status & Communication",
    description:
      "Service catalog, uptime history, and scheduled maintenance sharing the same truth as your responders.",
    bullets: ["Per-service health & uptime badges", "Scheduled maintenance announcements", "Public JSON status feed"],
    icon: GlobeAltIcon
  },
  {
    title: "Automation & Integrations",
    description:
      "Webhook ingestion with HMAC signatures plus outbound notifications to Slack, Discord, Teams, Telegram, and email.",
    bullets: ["GitHub Actions + UptimeRobot templates", "Dedupe + recovery workflow", "Multi-channel alerting"],
    icon: ArrowPathIcon
  },
  {
    title: "Evidence & Attachments",
    description:
      "Upload screenshots, log bundles, or HAR files to each incident and keep them accessible via signed URLs.",
    bullets: ["Up to 5 files per update", "Served securely via backend", "Storage adapter ready for S3"],
    icon: PaperClipIcon
  },
  {
    title: "Analytics & Audit",
    description:
      "MTTR/MTTA dashboards plus a full audit trail of every login, assignment, and maintenance action.",
    bullets: ["MTTR + MTTA snapshots", "Exportable audit log", "Ready for compliance reviews"],
    icon: ChartBarIcon
  }
];

export default function HomePage() {
  const { data, isLoading } = useStatus();
  const { data: session } = useSession();

  const activeCount = useMemo(() => data?.data.active_incidents.length ?? 0, [data]);
  const maintenance = data?.data?.scheduled_maintenance ?? { active: [], upcoming: [] };
  const nextMaintenance = maintenance.active[0] ?? maintenance.upcoming[0] ?? null;
  const overallState = data?.meta.state;
  const year = new Date().getFullYear();
  const isAuthenticated = Boolean(session);
  const primaryNavLabel = isAuthenticated ? "Dashboard" : "Sign In";
  const primaryNavHref = isAuthenticated ? "/dashboard" : "/login";
  const heroPrimaryLabel = isAuthenticated ? "Open Dashboard" : "View Docs";
  const heroPrimaryHref = isAuthenticated ? "/dashboard" : "/docs";
  const heroSecondaryLabel = isAuthenticated ? "View Status Page" : "Star on GitHub";
  const heroSecondaryHref = isAuthenticated ? "/status" : "https://github.com/bhoyee/IncidentPulse";

  return (
    <div className="min-h-screen bg-white w-full">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex h-20 items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700">
                  <span className="text-lg font-bold text-white">IP</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">IncidentPulse</span>
                  <span className="block text-xs text-blue-600 font-medium">ENTERPRISE</span>
                </div>
              </div>

              {/* Navigation */}
              <nav className="hidden items-center space-x-8 md:flex">
                <Link href="/status" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Status
                </Link>
                <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Features
                </a>
                <a href="#platform" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Platform
                </a>
                <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Documentation
                </Link>
                <a
                  href="https://github.com/bhoyee/IncidentPulse"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </nav>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-4">
                <Link
                  href="/status"
                  className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors md:block"
                >
                  View Status
                </Link>
                <Link
                  href={primaryNavHref}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  {primaryNavLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-50 to-blue-50 py-20 w-full">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left Column */}
              <div className="flex flex-col justify-center space-y-8">
                <div>
                  <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Open-Source & Self-Hosted
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                    Own Your Incident Response
                    <span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      For Modern Teams
                    </span>
                  </h1>
                  <p className="mt-6 text-lg text-gray-600 max-w-2xl">
                    IncidentPulse couples an authenticated operations console with a polished public status page. It&apos;s MIT licensed,
                    deploys anywhere, and keeps responders, stakeholders, and customers aligned from the same source of truth.
                  </p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <Link
                    href={heroPrimaryHref}
                    className="rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors text-center"
                  >
                    {heroPrimaryLabel}
                  </Link>
                  <a
                    href={heroSecondaryHref}
                    className="rounded-lg border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors text-center"
                    target={isAuthenticated ? "_self" : "_blank"}
                    rel="noreferrer"
                  >
                    {heroSecondaryLabel}
                  </a>
                </div>

                {/* Trust Indicators */}
                <div className="pt-8">
                  <p className="text-sm font-medium text-gray-500 mb-4">Trusted by engineering teams at</p>
                  <div className="flex items-center space-x-8 opacity-60">
                    <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
                    <UserGroupIcon className="h-8 w-8 text-gray-400" />
                    <ClockIcon className="h-8 w-8 text-gray-400" />
                    <div className="h-8 w-8 rounded-lg bg-gray-200"></div>
                    <div className="h-8 w-8 rounded-lg bg-gray-200"></div>
                  </div>
                </div>
              </div>

              {/* Right Column - Status Card */}
              <div className="flex flex-col space-y-6">
                {/* Highlights */}
                <div className="space-y-4">
                  {heroHighlights.map((item) => (
                    <div key={item} className="flex items-center space-x-3 rounded-lg bg-white p-4 shadow-sm border border-gray-100">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>

                {/* Live Status */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm text-gray-500">Live</span>
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">Checking system status...</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <StatusBanner
                        state={overallState}
                        activeMaintenanceCount={maintenance.active.length}
                        nextMaintenance={nextMaintenance}
                      />
                      <div className="space-y-3">
                        <div className="rounded-lg bg-gray-50 p-4">
                          <p className="text-sm text-gray-600">
                            {activeCount === 0
                              ? "All systems operational with no active incidents"
                              : `${activeCount} active ${activeCount === 1 ? "incident" : "incidents"} being monitored`}
                          </p>
                        </div>
                        {maintenance.active.length > 0 ? (
                          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                            Scheduled maintenance in progress for{" "}
                            {maintenance.active[0].appliesToAll
                              ? "all services"
                              : maintenance.active[0].service?.name ?? "select services"}
                            .
                          </div>
                        ) : nextMaintenance ? (
                          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            Next maintenance window begins{" "}
                            {new Date(nextMaintenance.startsAt).toLocaleString()}.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <Link
                    href="/status"
                    className="mt-4 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View Detailed Status
                    <PlayCircleIcon className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="mt-2 text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-50 py-20 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Enterprise-Grade Features
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                Designed for modern engineering teams that demand reliability, security, and seamless collaboration.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300"
                  >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{card.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="bg-white py-20 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid gap-16 lg:grid-cols-2">
              {/* Left Column */}
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                  Streamlined Incident Workflow
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  From detection to resolution, IncidentPulse provides a structured approach that ensures nothing falls through the cracks.
                </p>
                
                <div className="space-y-6">
                  {workflowSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="flex space-x-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <Icon className="h-6 w-6" />
                          </div>
                          {index < workflowSteps.length - 1 && (
                            <div className="h-full w-0.5 bg-gray-200 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                          <p className="text-gray-600">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column - Live Status Feed */}
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Live Status Feed</h3>
                  <Link
                    href="/status"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    View Full History
                  </Link>
                </div>

                {isLoading ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300">
                    <div className="text-sm text-gray-500">Loading incident data...</div>
                  </div>
                ) : data ? (
                  <div className="space-y-4">
                    <StatusBanner
                      state={overallState}
                      activeMaintenanceCount={maintenance.active.length}
                      nextMaintenance={nextMaintenance}
                    />
                    {activeCount === 0 ? (
                      <div className="rounded-lg bg-green-50 p-6 text-center">
                        <CheckCircleIcon className="mx-auto h-8 w-8 text-green-500 mb-2" />
                        <p className="text-sm font-medium text-green-800">All systems operational</p>
                        <p className="text-sm text-green-600 mt-1">No active incidents</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.data.active_incidents.map((incident) => (
                          <PublicIncidentCard key={incident.id} incident={incident} />
                        ))}
                      </div>
                    )}
                    {nextMaintenance ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        Next scheduled maintenance:{" "}
                        {nextMaintenance.appliesToAll
                          ? "All services"
                          : nextMaintenance.service?.name ?? "Select services"}{" "}
                        on {new Date(nextMaintenance.startsAt).toLocaleString()}.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300">
                    <div className="text-sm text-gray-500">Unable to load status data</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section
        id="platform"
        className="bg-slate-900 text-white w-screen relative left-1/2 right-1/2 -mx-[50vw] py-20"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
                Open Source + Production Ready
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need for calm incident response
              </h2>
              <p className="mt-4 text-lg text-slate-300 max-w-3xl mx-auto">
                Status pages, automation, evidence, analytics, and audits—all powered by the same backend so teams and customers stay aligned.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {platformHighlights.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <div
                    key={highlight.title}
                    className="rounded-2xl bg-slate-800/60 border border-slate-700 p-8 shadow-lg shadow-slate-900/20"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-2xl font-semibold">{highlight.title}</h3>
                    </div>
                    <p className="text-slate-200">{highlight.description}</p>
                    <ul className="mt-5 space-y-2 text-sm text-slate-200">
                      {highlight.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 text-emerald-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
              <a
                href="https://github.com/bhoyee/IncidentPulse"
                className="rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-blue-700 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors text-center"
                target="_blank"
                rel="noreferrer"
              >
                Star on GitHub
              </a>
              <Link
                href="/docs"
                className="rounded-lg border border-white px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors text-center"
              >
                Read the Documentation
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - FULL WIDTH */}

      <footer className="bg-gray-900 w-screen relative left-1/2 right-1/2 -mx-[50vw] py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">
            {/* Your footer content remains the same */}
                        <div className="grid gap-8 md:grid-cols-4">
                    {/* Company */}
                    <div className="md:col-span-2">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                          <span className="text-sm font-bold text-white">IP</span>
                        </div>
                        <span className="text-xl font-bold text-white">IncidentPulse</span>
                      </div>
                      <p className="text-gray-400 text-sm max-w-md">
                        Enterprise incident management platform designed for modern engineering teams. 
                        Reliable, secure, and built for scale.
                      </p>
                    </div>

                    {/* Links */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
                      <ul className="space-y-2 text-sm">
                        <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                        <li><a href="#platform" className="text-gray-400 hover:text-white transition-colors">Platform</a></li>
                        <li><Link href="/status" className="text-gray-400 hover:text-white transition-colors">Status</Link></li>
                        <li><Link href="/docs" className="text-gray-400 hover:text-white transition-colors">Documentation</Link></li>
                        <li>
                          <a
                            href="https://github.com/bhoyee/IncidentPulse"
                            className="text-gray-400 hover:text-white transition-colors"
                            target="_blank"
                            rel="noreferrer"
                          >
                            GitHub
                          </a>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <a href="/docs#overview" className="text-gray-400 hover:text-white transition-colors">
                            About
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://medium.com/@incidentpulse"
                            className="text-gray-400 hover:text-white transition-colors"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Blog
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://www.linkedin.com/company/incidentpulse"
                            className="text-gray-400 hover:text-white transition-colors"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Careers
                          </a>
                        </li>
                        <li>
                          <a
                            href="mailto:ades.salisu@gmail.com"
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            Contact
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-12 border-t border-gray-800 pt-8">
                    <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
                      <p className="text-sm text-gray-400">
                        &copy; {year} IncidentPulse. All rights reserved.
                      </p>
                      <div className="flex space-x-6 text-sm text-gray-400">
                        <a href="/docs#faq" className="hover:text-white transition-colors">Privacy</a>
                        <a href="/docs#credits" className="hover:text-white transition-colors">Terms</a>
                        <a href="/docs#architecture" className="hover:text-white transition-colors">Security</a>
                      </div>
                  </div>
                </div>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
