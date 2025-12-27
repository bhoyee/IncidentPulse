import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const signupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  orgName: z.string().min(2).max(120).optional(),
  orgSlug: z.string().regex(/^[a-z0-9-]+$/i, "Slug can contain letters, numbers and dashes").min(2).max(64).optional()
});

export const createIncidentSchema = z.object({
  title: z.string().min(3).max(120),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(10).max(5000),
  assignedToId: z.string().uuid().optional(),
  categories: z.array(z.string().min(2).max(50)).max(5).optional(),
  impactScope: z.string().min(3).max(200).optional(),
  serviceId: z.string().uuid(),
  // Optional flag used by the UI "Simulate incident" button to avoid sending notifications.
  simulate: z.boolean().optional()
});

export const updateIncidentSchema = z
  .object({
    title: z.string().min(3).max(120).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "investigating", "monitoring", "resolved"]).optional(),
    description: z.string().min(10).max(5000).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    categories: z.array(z.string().min(2).max(50)).max(5).optional(),
    impactScope: z.string().min(3).max(200).nullable().optional(),
    serviceId: z.string().uuid().optional(),
    rootCause: z.string().min(10).max(5000).optional(),
    resolutionSummary: z.string().min(10).max(2000).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

export const incidentQuerySchema = z.object({
  status: z.enum(["open", "investigating", "monitoring", "resolved"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  search: z.string().min(2).max(120).optional(),
  teamRole: z.string().min(2).max(50).optional(),
  assignedTo: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const incidentUpdateLogSchema = z.object({
  message: z.string().min(3).max(2000),
  attachmentIds: z.array(z.string().uuid()).max(5).optional()
});

export const teamUsersQuerySchema = z.object({
  search: z.string().min(2).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(["admin", "operator", "viewer"]).default("operator"),
  teamRoles: z.array(z.string().min(2).max(50)).max(10).default([]),
  isActive: z.boolean().optional(),
  password: z.string().min(10).max(128).optional()
});

export const updateUserSchema = z
  .object({
    role: z.enum(["admin", "operator", "viewer"]).optional(),
    isActive: z.boolean().optional(),
    teamRoles: z.array(z.string().min(2).max(50)).max(10).optional(),
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(10).max(128)
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Reset code must be a 6-digit value"),
  newPassword: z.string().min(10).max(128)
});

export const statusSubscribeSchema = z
  .object({
    email: z.string().email(),
    orgId: z.string().uuid().optional(),
    orgSlug: z
      .string()
      .regex(/^[a-z0-9-]+$/i, "Slug can contain letters, numbers and dashes")
      .min(2)
      .max(64)
      .optional(),
    serviceIds: z.array(z.string().uuid()).min(1).max(50).optional()
  })
  .strict();

export const statusVerifySchema = z.object({
  token: z.string().min(10).max(256)
});

export const statusUnsubscribeSchema = z.object({
  token: z.string().min(10).max(256)
});

export const statusSubscriberAdminCreateSchema = z
  .object({
    email: z.string().email(),
    serviceIds: z.array(z.string().uuid()).min(1).max(50).optional(),
    verifyNow: z.boolean().optional()
  })
  .strict();

export const statusSubscriberDeleteParamsSchema = z.object({
  id: z.string().uuid()
});

const maintenanceBaseSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  appliesToAll: z.boolean().optional(),
  serviceId: z.string().min(1).nullable().optional()
});

export const createMaintenanceSchema = maintenanceBaseSchema.superRefine((data, ctx) => {
  if (new Date(data.startsAt) >= new Date(data.endsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End time must be after the start time",
      path: ["endsAt"]
    });
  }

  if (data.appliesToAll === false && !data.serviceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a service or mark the event as global",
      path: ["serviceId"]
    });
  }
});

export const updateMaintenanceSchema = maintenanceBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after the start time",
        path: ["endsAt"]
      });
    }

    if (data.appliesToAll === false && !data.serviceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a service or mark the event as global",
        path: ["serviceId"]
      });
    }
  });

export const maintenanceQuerySchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "canceled"]).optional(),
  window: z.enum(["upcoming", "past", "all"]).optional(),
  serviceId: z.string().min(1).optional()
});

const auditActionValues = [
  "user_login",
  "user_created",
  "user_updated",
  "user_deleted",
  "incident_created",
  "incident_updated",
  "incident_resolved",
  "incident_investigating",
  "incident_monitoring",
  "incident_deleted",
  "maintenance_created",
  "maintenance_updated",
  "maintenance_canceled"
] as const;

export const auditLogQuerySchema = z.object({
  action: z.enum(auditActionValues).optional(),
  targetType: z.string().min(2).max(50).optional(),
  search: z.string().min(2).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const membershipUpdateSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "viewer"])
});
