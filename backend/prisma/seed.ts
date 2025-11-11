// backend/prisma/seed.ts
import { PrismaClient, IncidentStatus, Severity } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type DemoIncident = {
  title: string;
  severity: Severity;
  status: IncidentStatus;
  serviceSlug: string;
  description: string;
  createdMinutesAgo: number;
  assignedTo?: string;
  categories?: string[];
  impactScope?: string;
  firstResponseAfterMinutes?: number;
  resolvedAfterMinutes?: number;
  rootCause?: string;
  resolutionSummary?: string;
  updates: Array<{
    author: string;
    message: string;
    minutesAgo: number;
  }>;
};

// Demo accounts exposed publicly – keep credentials in sync with README/login page.
const demoUsers = [
  {
    email: "admin@incidentpulse.com",
    name: "Initial Admin",
    role: "admin" as const,
    password: "admin123",
    teamRoles: ["Admin"]
  },
  {
    email: "admin@demo.incidentpulse.com",
    name: "Demo Admin",
    role: "admin" as const,
    password: "admin123",
    teamRoles: ["Incident Commander"]
  },
  {
    email: "operator@demo.incidentpulse.com",
    name: "Demo Operator",
    role: "operator" as const,
    password: "demo123",
    teamRoles: ["On-call"]
  }
];

const demoServices = [
  {
    name: "Website",
    slug: "website",
    description: "Public marketing site and docs portal"
  },
  {
    name: "Status API",
    slug: "status-api",
    description: "Customer-facing API that powers status widgets"
  },
  {
    name: "Email Delivery",
    slug: "email-delivery",
    description: "Transactional email service for customer updates"
  },
  {
    name: "Incident Console",
    slug: "incident-console",
    description: "Internal dashboard used by responders"
  }
];

// Curated incident scenarios to showcase different severities/statuses in the demo.
const incidents: DemoIncident[] = [
  {
    title: "Major outage: status API returning 500s",
    severity: "critical",
    status: "investigating",
    serviceSlug: "status-api",
    description:
      "Customers started reporting 500 errors on the status API around 09:10 UTC. Initial investigation points to a cascading failure in the caching layer.",
    createdMinutesAgo: 120,
    assignedTo: "operator@demo.incidentpulse.com",
    categories: ["API", "Platform"],
    impactScope: "Status badges and third-party integrations are failing to load.",
    firstResponseAfterMinutes: 8,
    updates: [
      {
        author: "operator@demo.incidentpulse.com",
        message: "Investigating elevated 500s from api/status endpoints. Rolled back last deploy.",
        minutesAgo: 105
      },
      {
        author: "admin@demo.incidentpulse.com",
        message: "Identified spike in Redis latency. Provisioning additional replicas.",
        minutesAgo: 45
      }
    ]
  },
  {
    title: "Email delivery delays",
    severity: "high",
    status: "monitoring",
    serviceSlug: "email-delivery",
    description:
      "Message processing queue grew beyond healthy thresholds after an upstream provider hiccup. Traffic was drained to backup provider.",
    createdMinutesAgo: 240,
    assignedTo: "operator@demo.incidentpulse.com",
    categories: ["Email"],
    impactScope: "Incident notifications and password reset emails were delayed up to 15 minutes.",
    firstResponseAfterMinutes: 12,
    resolvedAfterMinutes: 150,
    rootCause: "Primary provider rate-limited our connection after hitting burst limits.",
    resolutionSummary:
      "Failed over to backup SMTP provider and widened rate-limit buffer to prevent future throttling.",
    updates: [
      {
        author: "operator@demo.incidentpulse.com",
        message: "Drained backlog to backup provider. Monitoring queue depth.",
        minutesAgo: 60
      },
      {
        author: "admin@demo.incidentpulse.com",
        message:
          "Issue resolved. Working on increased bursting capacity with SendFast and adding alert rules.",
        minutesAgo: 30
      }
    ]
  },
  {
    title: "Incident console login errors",
    severity: "medium",
    status: "open",
    serviceSlug: "incident-console",
    description:
      "Some operators report intermittent 401s after session refresh. Appears limited to EU region edge.",
    createdMinutesAgo: 45,
    assignedTo: undefined,
    categories: ["Authentication"],
    impactScope: "Operators in EU West region intermittently need to re-login when refreshing.",
    firstResponseAfterMinutes: 5,
    updates: [
      {
        author: "admin@incidentpulse.com",
        message: "Reproduced issue on EU edge. Investigating cookie domain config on new CDN POP.",
        minutesAgo: 30
      }
    ]
  },
  {
    title: "Docs site partial outage",
    severity: "low",
    status: "resolved",
    serviceSlug: "website",
    description:
      "Marketing/docs site served stale build for 20 minutes due to CI artifact upload failure.",
    createdMinutesAgo: 360,
    assignedTo: "operator@demo.incidentpulse.com",
    categories: ["Website"],
    impactScope: "New docs pages returned 404 between 10:05 and 10:25 UTC.",
    firstResponseAfterMinutes: 6,
    resolvedAfterMinutes: 40,
    rootCause: "Artifact upload step in CI skipped due to misconfigured secret.",
    resolutionSummary:
      "Re-ran build with corrected secret, added check to fail pipeline when upload step is skipped.",
    updates: [
      {
        author: "operator@demo.incidentpulse.com",
        message: "Rebuilt marketing site and flushed CDN. Monitoring 200 rates.",
        minutesAgo: 250
      }
    ]
  }
];

async function seedUsers() {
  const userRecords: Record<string, string> = {};

  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        teamRoles: user.teamRoles,
        passwordHash,
        isActive: true
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        teamRoles: user.teamRoles,
        isActive: true
      }
    });

    userRecords[user.email] = record.id;
  }

  console.log("Seeded demo users:");
  demoUsers.forEach((user) => {
    console.log(`  • ${user.email} / ${user.password}`);
  });

  return userRecords;
}

async function seedServices() {
  const serviceRecords: Record<string, string> = {};

  for (const service of demoServices) {
    const record = await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        description: service.description
      },
      create: service
    });

    serviceRecords[service.slug] = record.id;
  }

  return serviceRecords;
}

async function seedIncidents(userIds: Record<string, string>, serviceIds: Record<string, string>) {
  // Remove any previously seeded demo incidents before inserting fresh copies.
  const demoTitles = incidents.map((incident) => incident.title);
  await prisma.incidentUpdate.deleteMany({
    where: { incident: { title: { in: demoTitles } } }
  });
  await prisma.incident.deleteMany({
    where: { title: { in: demoTitles } }
  });

  const now = new Date();

  for (const incident of incidents) {
    const createdAt = new Date(now.getTime() - incident.createdMinutesAgo * 60 * 1000);
    const firstResponseAt =
      incident.firstResponseAfterMinutes !== undefined
        ? new Date(createdAt.getTime() + incident.firstResponseAfterMinutes * 60 * 1000)
        : null;
    const resolvedAt =
      incident.resolvedAfterMinutes !== undefined
        ? new Date(createdAt.getTime() + incident.resolvedAfterMinutes * 60 * 1000)
        : null;

    const record = await prisma.incident.create({
      data: {
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        serviceId: serviceIds[incident.serviceSlug],
        createdById: userIds["admin@incidentpulse.com"],
        assignedToId: incident.assignedTo ? userIds[incident.assignedTo] : null,
        categories: incident.categories ?? [],
        impactScope: incident.impactScope,
        firstResponseAt,
        resolvedAt,
        rootCause: incident.rootCause,
        resolutionSummary: incident.resolutionSummary,
        createdAt,
        updatedAt: resolvedAt ?? now
      }
    });

    for (const update of incident.updates) {
      const updateTime = new Date(now.getTime() - update.minutesAgo * 60 * 1000);
      await prisma.incidentUpdate.create({
        data: {
          incidentId: record.id,
          authorId: userIds[update.author],
          message: update.message,
          createdAt: updateTime
        }
      });
    }
  }

  console.log("Seeded demo incidents and timeline updates.");
}

async function seedMaintenance(serviceIds: Record<string, string>, userIds: Record<string, string>) {
  const now = new Date();
  // Same idea for maintenance events – keep demo data deterministic.
  await prisma.maintenanceEvent.deleteMany({
    where: {
      title: {
        in: [
          "Database maintenance window",
          "Docs site upgrade deployment"
        ]
      }
    }
  });

  await prisma.maintenanceEvent.create({
    data: {
      title: "Database maintenance window",
      description:
        "Performing a rolling upgrade on the primary database cluster. Read replicas remain available.",
      status: "in_progress",
      appliesToAll: true,
      startsAt: new Date(now.getTime() - 30 * 60 * 1000),
      endsAt: new Date(now.getTime() + 45 * 60 * 1000),
      createdById: userIds["admin@demo.incidentpulse.com"]
    }
  });

  await prisma.maintenanceEvent.create({
    data: {
      title: "Docs site upgrade deployment",
      description: "Deploying new docs navigation and caching headers.",
      status: "scheduled",
      appliesToAll: false,
      serviceId: serviceIds["website"],
      startsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      createdById: userIds["admin@incidentpulse.com"]
    }
  });

  console.log("Seeded maintenance events.");
}

async function main() {
  console.log("Seeding IncidentPulse demo data…");
  const users = await seedUsers();
  const services = await seedServices();
  await seedIncidents(users, services);
  await seedMaintenance(services, users);
  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
