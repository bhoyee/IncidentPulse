import type {
  Incident,
  IncidentUpdate,
  Membership,
  Organization,
  PrismaClient,
  Service
} from "@prisma/client";
import { DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";

const prisma = mockDeep<PrismaClient>();

const defaultOrg: Organization = {
  id: "org-default",
  name: "Default Org",
  slug: "platform",
  plan: "free",
  status: "active",
  rateLimitPerMinute: 500,
  isDeleted: false,
  deletedAt: null,
  stripeCustomerId: null,
  billingStatus: "active",
  createdAt: new Date(),
  updatedAt: new Date()
};

const defaultService: Service = {
  id: "service-platform",
  name: "Platform",
  slug: "platform",
  description: "Default platform service",
  organizationId: defaultOrg.id,
  createdAt: new Date(),
  updatedAt: new Date()
};

const defaultMembership: Membership = {
  id: "member-default",
  userId: "user-default",
  organizationId: defaultOrg.id,
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
};

const defaultIncident: Incident = {
  id: "incident-default",
  title: "Test Incident",
  description: "Fixture incident",
  severity: "low",
  status: "open",
  organizationId: defaultOrg.id,
  serviceId: defaultService.id,
  startedAt: new Date(),
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  isDemo: false,
  createdById: defaultMembership.userId
};

const applyDefaults = () => {
  // Organizations
  prisma.organization.upsert.mockResolvedValue(defaultOrg);
  prisma.organization.findUnique.mockResolvedValue(defaultOrg);
  prisma.organization.create.mockResolvedValue(defaultOrg);
  prisma.organization.findFirst.mockResolvedValue(defaultOrg);
  prisma.organization.findMany.mockResolvedValue([defaultOrg]);

  // Memberships
  prisma.membership.create.mockResolvedValue(defaultMembership);
  prisma.membership.findMany.mockResolvedValue([defaultMembership]);
  prisma.membership.findFirst.mockResolvedValue(defaultMembership);

  // Services
  prisma.service.findFirst.mockResolvedValue(defaultService);
  prisma.service.findUnique.mockResolvedValue(defaultService);
  prisma.service.findMany.mockResolvedValue([defaultService]);
  prisma.service.create.mockResolvedValue(defaultService);
  prisma.service.upsert.mockResolvedValue(defaultService);

  // Incidents
  prisma.incident.count.mockResolvedValue(0);
  prisma.incident.findMany.mockResolvedValue([]);
  prisma.incident.findFirst.mockResolvedValue(defaultIncident);
  prisma.incident.create.mockResolvedValue(defaultIncident);
  prisma.incident.update.mockResolvedValue(defaultIncident);

  const defaultUpdate: IncidentUpdate = {
    id: "incident-update-default",
    incidentId: defaultIncident.id,
    message: "Update",
    authorId: defaultMembership.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "update",
    rootCause: null,
    resolutionSummary: null,
    status: defaultIncident.status
  };
  prisma.incidentUpdate.create.mockResolvedValue(defaultUpdate);
  prisma.incidentUpdate.findMany.mockResolvedValue([defaultUpdate]);
  prisma.incidentUpdate.findFirst.mockResolvedValue(defaultUpdate);

  // Status cache
  prisma.statusCache.findUnique.mockResolvedValue(null as any);
  prisma.statusCache.upsert.mockResolvedValue({
    key: "status:platform",
    payload: {},
    createdAt: new Date(),
    updatedAt: new Date()
  } as any);

  // Raw/query helpers
  prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  prisma.$queryRaw.mockResolvedValue([] as any);
};

applyDefaults();

export const resetPrismaMock = () => {
  mockReset(prisma);
  applyDefaults();
};

export default prisma as unknown as DeepMockProxy<PrismaClient>;
