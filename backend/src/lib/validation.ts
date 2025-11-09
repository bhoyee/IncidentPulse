import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const createIncidentSchema = z.object({
  title: z.string().min(3).max(120),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(10).max(5000),
  assignedToId: z.string().uuid().optional(),
  categories: z.array(z.string().min(2).max(50)).max(5).optional(),
  impactScope: z.string().min(3).max(200).optional(),
  serviceId: z.string().uuid()
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
