import { randomUUID } from "node:crypto";
import type {
  AuditLog,
  Incident,
  IncidentAttachment,
  IncidentStatus,
  IncidentUpdate,
  MaintenanceEvent,
  Membership,
  MembershipRole,
  Organization,
  OrgStatus,
  PasswordResetToken,
  Plan,
  BillingStatus,
  Service,
  Severity,
  StatusCache,
  User,
  Role,
  PlatformRole
} from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { mockDeep, type DeepMockProxy } from "jest-mock-extended";

const makeDate = () => new Date();
const newId = () => randomUUID();

type Store = {
  orgs: Organization[];
  users: User[];
  services: Service[];
  incidents: Incident[];
  updates: IncidentUpdate[];
  memberships: Membership[];
  auditLogs: AuditLog[];
  incidentAttachments: IncidentAttachment[];
  passwordResetTokens: PasswordResetToken[];
  statusCache: StatusCache[];
  maintenanceEvents: MaintenanceEvent[];
};

const getInitialStore = (): Store => {
  const seedOrg: Organization = {
    id: "org-default",
    name: "Default Org",
    slug: "default-org",
    plan: "free" as Plan,
    billingStatus: "active" as BillingStatus,
    rateLimitPerMinute: 120,
    status: "active" as OrgStatus,
    isDeleted: false,
    deletedAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: makeDate(),
    updatedAt: makeDate()
  };

  const seedUser: User = {
    id: "user-default",
    email: "admin@demo.incidentpulse.com",
    passwordHash: "hash",
    role: "admin" as Role,
    name: "Admin",
    teamRoles: [],
    isActive: true,
    isSuperAdmin: false,
    platformRole: "none" as PlatformRole,
    createdAt: makeDate(),
    updatedAt: makeDate()
  };

  const seedService: Service = {
    id: "service-default",
    name: "Platform",
    slug: "platform",
    description: null,
    organizationId: seedOrg.id,
    createdAt: makeDate(),
    updatedAt: makeDate()
  };

  const seedIncident: Incident = {
    id: "incident-default",
    title: "Seed Incident",
    description: "Seed description",
    severity: "low" as Severity,
    status: "open" as IncidentStatus,
    organizationId: seedOrg.id,
    serviceId: seedService.id,
    createdAt: makeDate(),
    updatedAt: makeDate(),
    resolvedAt: null,
    resolutionSummary: null,
    rootCause: null,
    createdById: seedUser.id,
    escalationNotifiedAt: null,
    assignedToId: null,
    firstResponseAt: null,
    categories: [],
    impactScope: null
  };

  const seedUpdate: IncidentUpdate = {
    id: "incident-update-default",
    incidentId: seedIncident.id,
    authorId: seedUser.id,
    message: "Seed update",
    createdAt: makeDate()
  };

  const seedMembership: Membership = {
    id: "membership-default",
    userId: seedUser.id,
    organizationId: seedOrg.id,
    role: "admin" as MembershipRole,
    createdAt: makeDate(),
    updatedAt: makeDate()
  };

  return {
    orgs: [seedOrg],
    users: [seedUser],
    services: [seedService],
    incidents: [seedIncident],
    updates: [seedUpdate],
    memberships: [seedMembership],
    auditLogs: [],
    incidentAttachments: [],
    passwordResetTokens: [],
    statusCache: [],
    maintenanceEvents: []
  };
};

let store = getInitialStore();

const prisma = mockDeep<PrismaClient>() as any;

const applySelect = <T extends Record<string, any>>(data: T, select?: Record<string, any>) => {
  if (!select) return data;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      result[key] = data[key];
    }
  }
  return result as T;
};

const includeIncidentRelations = (incident: Incident, include?: Record<string, any>) => {
  if (!include) return incident as any;
  const withRelations: Record<string, any> = { ...incident };

  if (include.organization) {
    const org = store.orgs.find((o) => o.id === incident.organizationId) || null;
    withRelations.organization = org
      ? applySelect(org, include.organization.select)
      : null;
  }

  if (include.assignedTo) {
    const user = store.users.find((u) => u.id === incident.assignedToId) || null;
    withRelations.assignedTo = user
      ? applySelect(user, include.assignedTo.select)
      : null;
  }

  if (include.createdBy) {
    const user = store.users.find((u) => u.id === incident.createdById) || null;
    withRelations.createdBy = user
      ? applySelect(user, include.createdBy.select)
      : null;
  }

  if (include.service) {
    const service = store.services.find((s) => s.id === incident.serviceId) || null;
    withRelations.service = service
      ? applySelect(service, include.service.select)
      : null;
  }

  return withRelations as any;
};

const matchesRole = (role: MembershipRole, filter: any) => {
  if (!filter) return true;
  if (typeof filter === "string") return role === filter;
  if (Array.isArray(filter.in)) return filter.in.includes(role);
  return true;
};

const selectMembership = (membership: Membership, select?: Record<string, any>) => {
  if (!select) return membership as any;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      result[key] = (membership as any)[key];
    }
    if (key === "organization" && value?.select) {
      const org = store.orgs.find((o) => o.id === membership.organizationId) || null;
      result.organization = org ? applySelect(org, value.select) : null;
    }
  }
  return result as any;
};

const initMock = () => {
  prisma.$connect.mockImplementation(async () => {});
  prisma.$disconnect.mockImplementation(async () => {});
  prisma.$transaction.mockImplementation(async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(prisma);
  });
  prisma.$executeRawUnsafe.mockImplementation(async () => 0);
  prisma.$executeRaw.mockImplementation(async () => 0);
  prisma.$queryRawUnsafe.mockImplementation(async () => []);
  prisma.$queryRaw.mockImplementation(async () => []);

  prisma.organization.findUnique.mockImplementation(async (args: any) => {
    const where = args?.where;
    if (!where || (!where.id && !where.slug && !where.stripeCustomerId)) return null;
    const org = store.orgs.find(
      (o) =>
        (where.id && o.id === where.id) ||
        (where.slug && o.slug === where.slug) ||
        (where.stripeCustomerId && o.stripeCustomerId === where.stripeCustomerId)
    );
    if (!org) return null;
    return applySelect(org, args?.select);
  });
  prisma.organization.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    const filtered = store.orgs.filter((o) => {
      if (!where) return true;
      if (where.id && o.id !== where.id) return false;
      if (where.slug && o.slug !== where.slug) return false;
      if (where.status && o.status !== where.status) return false;
      if (where.isDeleted !== undefined && o.isDeleted !== where.isDeleted) return false;
      return true;
    });
    return filtered.map((org) => applySelect(org, args?.select));
  });
  prisma.organization.upsert.mockImplementation(async ({ where, create, update }: any) => {
    const existing = await prisma.organization.findUnique({ where });
    if (existing) {
      const updated = { ...existing, ...update, updatedAt: makeDate() };
      store.orgs = store.orgs.map((o) => (o.id === (existing as Organization).id ? (updated as Organization) : o));
      return updated;
    }
    const created: Organization = {
      id: create.id ?? newId(),
      ...create,
      plan: create.plan ?? ("free" as Plan),
      billingStatus: create.billingStatus ?? ("active" as BillingStatus),
      rateLimitPerMinute: create.rateLimitPerMinute ?? 120,
      status: create.status ?? ("active" as OrgStatus),
      isDeleted: create.isDeleted ?? false,
      deletedAt: create.deletedAt ?? null,
      stripeCustomerId: create.stripeCustomerId ?? null,
      stripeSubscriptionId: create.stripeSubscriptionId ?? null,
      createdAt: create.createdAt ?? makeDate(),
      updatedAt: create.updatedAt ?? makeDate()
    };
    store.orgs.push(created);
    return created;
  });
  prisma.organization.create.mockImplementation(async ({ data }: any) => {
    const created: Organization = {
      id: data.id ?? newId(),
      ...data,
      plan: data.plan ?? ("free" as Plan),
      billingStatus: data.billingStatus ?? ("active" as BillingStatus),
      rateLimitPerMinute: data.rateLimitPerMinute ?? 120,
      status: data.status ?? ("active" as OrgStatus),
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.orgs.push(created);
    return created;
  });
  prisma.organization.update.mockImplementation(async ({ where, data, select }: any) => {
    const existing = await prisma.organization.findUnique({ where });
    if (!existing) throw new Error("Organization not found");
    const updated = { ...(existing as Organization), ...data, updatedAt: makeDate() };
    store.orgs = store.orgs.map((o) => (o.id === (existing as Organization).id ? updated : o));
    return applySelect(updated, select);
  });
  prisma.organization.delete.mockImplementation(async ({ where }: any) => {
    const existing = await prisma.organization.findUnique({ where });
    if (!existing) throw new Error("Organization not found");
    store.orgs = store.orgs.filter((o) => o.id !== (existing as Organization).id);
    return existing;
  });

  prisma.user.findUnique.mockImplementation(async (args: any) => {
    const where = args?.where;
    if (!where || (!where.id && !where.email)) return null;
    const user = store.users.find(
      (u) => (where.id && u.id === where.id) || (where.email && u.email === where.email)
    );
    if (!user) return null;
    return applySelect(user, args?.select);
  });
  prisma.user.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    const user = store.users.find((u) => {
      if (where.id && u.id !== where.id) return false;
      if (where.email && u.email !== where.email) return false;
      if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
      return true;
    });
    if (!user) return null;
    return applySelect(user, args?.select);
  });
  prisma.user.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    const filtered = store.users.filter((u) => {
      if (where.role && u.role !== where.role) return false;
      if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
      return true;
    });
    return filtered.map((u) => applySelect(u, args?.select));
  });
  prisma.user.create.mockImplementation(async ({ data }: any) => {
    const created: User = {
      id: data.id ?? newId(),
      passwordHash: data.passwordHash ?? "mock-hash",
      ...data,
      role: data.role ?? ("viewer" as Role),
      teamRoles: data.teamRoles ?? [],
      isActive: data.isActive ?? true,
      isSuperAdmin: Boolean(data.isSuperAdmin),
      platformRole: data.platformRole ?? ("none" as PlatformRole),
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.users.push(created);
    return created;
  });
  prisma.user.update.mockImplementation(async ({ where, data }: any) => {
    const existing = store.users.find(
      (u) => (where.id && u.id === where.id) || (where.email && u.email === where.email)
    );
    if (!existing) throw new Error("User not found");
    const updated = { ...existing, ...data, updatedAt: makeDate() };
    store.users = store.users.map((u) => (u.id === existing.id ? updated : u));
    return updated;
  });

  prisma.membership.findUnique.mockImplementation(async (args: any) => {
    const where = args?.where;
    if (!where) return null;
    const membership = store.memberships.find((m) => {
      if (where.id && m.id === where.id) return true;
      if (
        where.userId_organizationId &&
        m.userId === where.userId_organizationId.userId &&
        m.organizationId === where.userId_organizationId.organizationId
      ) {
        return true;
      }
      return false;
    });
    if (!membership) return null;
    return applySelect(membership, args?.select);
  });
  prisma.membership.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    if (!where) return null;
    const membership = store.memberships.find((m) => {
      if (where.userId && m.userId !== where.userId) return false;
      if (where.organizationId && m.organizationId !== where.organizationId) return false;
      if (where.role && !matchesRole(m.role, where.role)) return false;
      return true;
    });
    if (!membership) return null;
    if (args?.include?.organization) {
      const org = store.orgs.find((o) => o.id === membership.organizationId) || null;
      return {
        ...membership,
        organization: org ? applySelect(org, args.include.organization.select) : null
      } as any;
    }
    if (args?.select) {
      return selectMembership(membership, args.select);
    }
    return membership;
  });
  prisma.membership.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    const filtered = store.memberships.filter((m) => {
      if (!where) return true;
      if (where.userId && m.userId !== where.userId) return false;
      if (where.organizationId && m.organizationId !== where.organizationId) return false;
      if (where.role && !matchesRole(m.role, where.role)) return false;
      if (where.organization?.isDeleted !== undefined) {
        const org = store.orgs.find((o) => o.id === m.organizationId);
        if (!org || org.isDeleted !== where.organization.isDeleted) return false;
      }
      return true;
    });
    return filtered.map((m) => {
      if (args?.include?.organization) {
        const org = store.orgs.find((o) => o.id === m.organizationId) || null;
        return {
          ...m,
          organization: org ? applySelect(org, args.include.organization.select) : null
        } as any;
      }
      if (args?.select) return selectMembership(m, args.select);
      return m;
    });
  });
  prisma.membership.create.mockImplementation(async ({ data, select }: any) => {
    const created: Membership = {
      id: data.id ?? newId(),
      userId: data.userId,
      organizationId: data.organizationId,
      role: data.role ?? ("viewer" as MembershipRole),
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.memberships.push(created);
    return select ? applySelect(created, select) : created;
  });
  prisma.membership.createMany.mockImplementation(async ({ data }: any) => {
    const newMemberships = data.map((d: any) => ({
      id: d.id ?? newId(),
      userId: d.userId,
      organizationId: d.organizationId,
      role: d.role ?? ("viewer" as MembershipRole),
      createdAt: makeDate(),
      updatedAt: makeDate()
    }));
    store.memberships.push(...newMemberships);
    return { count: newMemberships.length };
  });
  prisma.membership.upsert.mockImplementation(async ({ where, create, update }: any) => {
    const existing = await prisma.membership.findUnique({ where });
    if (existing) {
      const updated = { ...(existing as Membership), ...update, updatedAt: makeDate() };
      store.memberships = store.memberships.map((m) => (m.id === updated.id ? updated : m));
      return updated;
    }
    const created: Membership = {
      id: create.id ?? newId(),
      userId: create.userId,
      organizationId: create.organizationId,
      role: create.role ?? ("viewer" as MembershipRole),
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.memberships.push(created);
    return created;
  });
  prisma.membership.update.mockImplementation(async ({ where, data }: any) => {
    const existing = await prisma.membership.findUnique({ where });
    if (!existing) throw new Error("Membership not found");
    const updated = { ...(existing as Membership), ...data, updatedAt: makeDate() };
    store.memberships = store.memberships.map((m) => (m.id === updated.id ? updated : m));
    return updated;
  });
  prisma.membership.delete.mockImplementation(async ({ where }: any) => {
    const existing = await prisma.membership.findUnique({ where });
    if (!existing) throw new Error("Membership not found");
    store.memberships = store.memberships.filter((m) => m.id !== (existing as Membership).id);
    return existing;
  });
  prisma.membership.count.mockImplementation(async ({ where }: any = {}) => {
    if (!where) return store.memberships.length;
    return store.memberships.filter((m) => {
      if (where.userId && m.userId !== where.userId) return false;
      if (where.organization?.isDeleted !== undefined) {
        const org = store.orgs.find((o) => o.id === m.organizationId);
        if (!org || org.isDeleted !== where.organization.isDeleted) return false;
      }
      return true;
    }).length;
  });

  prisma.service.findUnique.mockImplementation(async (args: any) => {
    const where = args?.where;
    if (!where || !where.id) return null;
    return store.services.find((s) => s.id === where.id) || null;
  });
  prisma.service.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    if (!where) return null;
    const service = store.services.find((s) => {
      if (where.id && s.id !== where.id) return false;
      if (where.slug && s.slug !== where.slug) return false;
      if (where.organizationId && s.organizationId !== where.organizationId) return false;
      return true;
    });
    return service || null;
  });
  prisma.service.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    if (!where) return [...store.services];
    return store.services.filter((s) => {
      if (where.organizationId && s.organizationId !== where.organizationId) return false;
      return true;
    });
  });
  prisma.service.upsert.mockImplementation(async ({ where, create, update }: any) => {
    const existing = await prisma.service.findFirst({ where });
    if (existing) {
      const updated = { ...existing, ...update, updatedAt: makeDate() };
      store.services = store.services.map((s) => (s.id === existing.id ? updated : s));
      return updated;
    }
    const created: Service = {
      id: create.id ?? newId(),
      ...create,
      description: create.description ?? null,
      createdAt: create.createdAt ?? makeDate(),
      updatedAt: create.updatedAt ?? makeDate()
    };
    store.services.push(created);
    return created;
  });
  prisma.service.create.mockImplementation(async ({ data }: any) => {
    const created: Service = {
      id: data.id ?? newId(),
      ...data,
      description: data.description ?? null,
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.services.push(created);
    return created;
  });
  prisma.service.update.mockImplementation(async ({ where, data }: any) => {
    const existing = await prisma.service.findUnique({ where });
    if (!existing) throw new Error("Service not found");
    const updated = { ...existing, ...data, updatedAt: makeDate() };
    store.services = store.services.map((s) => (s.id === existing.id ? updated : s));
    return updated;
  });

  prisma.incident.findUnique.mockImplementation(async (args: any) => {
    const where = args?.where;
    if (!where || !where.id) return null;
    const incident = store.incidents.find((i) => {
      if (i.id !== where.id) return false;
      if (where.organizationId && i.organizationId !== where.organizationId) return false;
      return true;
    });
    if (!incident) return null;
    if (args?.select) return applySelect(incident, args.select);
    return includeIncidentRelations(incident, args?.include);
  });
  prisma.incident.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    let filtered = [...store.incidents];
    if (where?.organizationId) {
      filtered = filtered.filter((i) => i.organizationId === where.organizationId);
    }
    if (where?.AND && Array.isArray(where.AND)) {
      for (const condition of where.AND) {
        if (condition.organizationId) {
          filtered = filtered.filter((i) => i.organizationId === condition.organizationId);
        }
        if (condition.status) {
          filtered = filtered.filter((i) => i.status === condition.status);
        }
        if (condition.severity) {
          filtered = filtered.filter((i) => i.severity === condition.severity);
        }
        if (condition.assignedToId) {
          filtered = filtered.filter((i) => i.assignedToId === condition.assignedToId);
        }
        if (condition.serviceId) {
          filtered = filtered.filter((i) => i.serviceId === condition.serviceId);
        }
        if (condition.OR && Array.isArray(condition.OR)) {
          filtered = filtered.filter((i) =>
            condition.OR.some((or: any) => {
              if (or.createdById && i.createdById === or.createdById) return true;
              if (or.assignedToId && i.assignedToId === or.assignedToId) return true;
              return false;
            })
          );
        }
      }
    }
    return filtered.map((incident) => includeIncidentRelations(incident, args?.include));
  });
  prisma.incident.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    let filtered = [...store.incidents];
    if (where.organizationId) {
      filtered = filtered.filter((i) => i.organizationId === where.organizationId);
    }
    if (args?.orderBy?.updatedAt) {
      filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    const incident = filtered[0] ?? null;
    if (!incident) return null;
    return args?.select ? applySelect(incident, args.select) : incident;
  });
  prisma.incident.count.mockImplementation(async ({ where }: any = {}) => {
    let filtered = [...store.incidents];
    if (where?.organizationId) {
      filtered = filtered.filter((i) => i.organizationId === where.organizationId);
    }
    if (where?.createdAt?.gte) {
      filtered = filtered.filter((i) => i.createdAt >= where.createdAt.gte);
    }
    return filtered.length;
  });
  prisma.incident.create.mockImplementation(async ({ data, include }: any) => {
    const created: Incident = {
      id: data.id ?? newId(),
      title: data.title,
      status: data.status ?? ("open" as IncidentStatus),
      createdAt: data.createdAt ?? makeDate(),
      updatedAt: data.updatedAt ?? makeDate(),
      description: data.description ?? "",
      severity: data.severity ?? ("low" as Severity),
      organizationId: data.organizationId ?? "org-default",
      serviceId: data.serviceId ?? store.services[0]?.id ?? "service-default",
      resolvedAt: data.resolvedAt ?? null,
      resolutionSummary: data.resolutionSummary ?? null,
      rootCause: data.rootCause ?? null,
      createdById: data.createdById ?? store.users[0]?.id ?? "user-default",
      escalationNotifiedAt: data.escalationNotifiedAt ?? null,
      assignedToId: data.assignedToId ?? null,
      firstResponseAt: data.firstResponseAt ?? null,
      categories: data.categories ?? [],
      impactScope: data.impactScope ?? null
    };
    store.incidents.push(created);
    return includeIncidentRelations(created, include);
  });
  prisma.incident.update.mockImplementation(async ({ where, data, include, select }: any) => {
    const existing = store.incidents.find((i) => {
      if (where.id && i.id !== where.id) return false;
      if (where.organizationId && i.organizationId !== where.organizationId) return false;
      return true;
    });
    if (!existing) throw new Error("Incident not found");
    const updated = { ...existing, ...data, updatedAt: makeDate() };
    store.incidents = store.incidents.map((i) => (i.id === existing.id ? updated : i));
    if (select) return applySelect(updated, select);
    return includeIncidentRelations(updated, include);
  });
  prisma.incident.delete.mockImplementation(async ({ where }: any) => {
    const existing = await prisma.incident.findUnique({ where });
    if (!existing) throw new Error("Incident not found");
    store.incidents = store.incidents.filter((i) => i.id !== (existing as Incident).id);
    return existing;
  });

  prisma.incidentUpdate.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where;
    if (!where) return [...store.updates];
    return store.updates.filter((u) => {
      if (where.incidentId && u.incidentId !== where.incidentId) return false;
      return true;
    });
  });
  prisma.incidentUpdate.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    let filtered = [...store.updates];
    if (where.incident?.organizationId) {
      const incidentIds = store.incidents
        .filter((i) => i.organizationId === where.incident.organizationId)
        .map((i) => i.id);
      filtered = filtered.filter((u) => incidentIds.includes(u.incidentId));
    }
    if (args?.orderBy?.createdAt) {
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const update = filtered[0] ?? null;
    if (!update) return null;
    return args?.select ? applySelect(update, args.select) : update;
  });
  prisma.incidentUpdate.create.mockImplementation(async ({ data }: any) => {
    const created: IncidentUpdate = {
      id: data.id ?? newId(),
      incidentId: data.incidentId,
      authorId: data.authorId,
      message: data.message,
      createdAt: data.createdAt ?? makeDate()
    };
    store.updates.push(created);
    return created;
  });

  prisma.incidentAttachment.findMany.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    return store.incidentAttachments.filter((a) => {
      if (where.id?.in && !where.id.in.includes(a.id)) return false;
      if (where.incidentId && a.incidentId !== where.incidentId) return false;
      if (where.updateId !== undefined && a.updateId !== where.updateId) return false;
      if (where.uploadedById && a.uploadedById !== where.uploadedById) return false;
      return true;
    });
  });
  prisma.incidentAttachment.create.mockImplementation(async ({ data, include }: any) => {
    const created: IncidentAttachment = {
      id: data.id ?? newId(),
      incidentId: data.incidentId,
      updateId: data.updateId ?? null,
      uploadedById: data.uploadedById,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      path: data.path,
      createdAt: data.createdAt ?? makeDate()
    };
    store.incidentAttachments.push(created);
    if (include?.uploadedBy) {
      const user = store.users.find((u) => u.id === created.uploadedById) || null;
      return {
        ...created,
        uploadedBy: user ? applySelect(user, include.uploadedBy.select) : null
      } as any;
    }
    return created;
  });
  prisma.incidentAttachment.updateMany.mockImplementation(async ({ where, data }: any) => {
    const matches = store.incidentAttachments.filter((a) => {
      if (where.id?.in && !where.id.in.includes(a.id)) return false;
      return true;
    });
    store.incidentAttachments = store.incidentAttachments.map((a) =>
      matches.some((m) => m.id === a.id) ? { ...a, ...data } : a
    );
    return { count: matches.length };
  });
  prisma.incidentAttachment.findUnique.mockImplementation(async ({ where, select }: any) => {
    const attachment = store.incidentAttachments.find((a) => a.id === where.id) || null;
    if (!attachment) return null;
    return select ? applySelect(attachment, select) : attachment;
  });
  prisma.incidentAttachment.delete.mockImplementation(async ({ where }: any) => {
    const existing = store.incidentAttachments.find((a) => a.id === where.id) || null;
    if (!existing) throw new Error("Attachment not found");
    store.incidentAttachments = store.incidentAttachments.filter((a) => a.id !== existing.id);
    return existing;
  });

  prisma.auditLog.create.mockImplementation(async ({ data }: any) => {
    const created: AuditLog = {
      id: data.id ?? newId(),
      action: data.action,
      actorId: data.actorId ?? null,
      actorEmail: data.actorEmail ?? null,
      actorName: data.actorName ?? null,
      organizationId: data.organizationId ?? "org-default",
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      metadata: data.metadata ?? null,
      createdAt: makeDate()
    };
    store.auditLogs.push(created);
    return created;
  });
  prisma.auditLog.findMany.mockImplementation(async () => [...store.auditLogs]);

  prisma.passwordResetToken.deleteMany.mockImplementation(async ({ where }: any) => {
    const before = store.passwordResetTokens.length;
    store.passwordResetTokens = store.passwordResetTokens.filter((t) => t.userId !== where.userId);
    return { count: before - store.passwordResetTokens.length };
  });
  prisma.passwordResetToken.create.mockImplementation(async ({ data }: any) => {
    const created: PasswordResetToken = {
      id: data.id ?? newId(),
      userId: data.userId,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      consumedAt: data.consumedAt ?? null,
      createdAt: data.createdAt ?? makeDate()
    };
    store.passwordResetTokens.push(created);
    return created;
  });
  prisma.passwordResetToken.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args?.where ?? {};
    const found = store.passwordResetTokens.find((t) => {
      if (where.userId && t.userId !== where.userId) return false;
      if (where.consumedAt === null && t.consumedAt !== null) return false;
      if (where.expiresAt?.gt && t.expiresAt <= where.expiresAt.gt) return false;
      return true;
    });
    return found ?? null;
  });
  prisma.passwordResetToken.update.mockImplementation(async ({ where, data }: any) => {
    const existing = store.passwordResetTokens.find((t) => t.id === where.id);
    if (!existing) throw new Error("Token not found");
    const updated = { ...existing, ...data };
    store.passwordResetTokens = store.passwordResetTokens.map((t) => (t.id === existing.id ? updated : t));
    return updated;
  });

  prisma.statusSubscriber.findMany.mockImplementation(async () => []);
  prisma.maintenanceEvent.findMany.mockImplementation(async () => []);

  prisma.statusCache.upsert.mockImplementation(async ({ where, create, update }: any) => {
    const existing = store.statusCache.find((c) => c.id === where.id);
    if (existing) {
      const updated = { ...existing, ...update, updatedAt: makeDate() };
      store.statusCache = store.statusCache.map((c) => (c.id === existing.id ? updated : c));
      return updated;
    }
    const created: StatusCache = {
      id: create.id ?? newId(),
      state: create.state,
      uptime24h: create.uptime24h,
      payload: create.payload,
      createdAt: makeDate(),
      updatedAt: makeDate()
    };
    store.statusCache.push(created);
    return created;
  });
  prisma.statusCache.findUnique.mockImplementation(async ({ where }: any) => {
    return store.statusCache.find((c) => c.id === where.id) || null;
  });
};

initMock();

export function resetPrismaMock() {
  store = getInitialStore();
  jest.clearAllMocks();
  initMock();
}

export { prisma };
export default prisma as DeepMockProxy<PrismaClient>;
