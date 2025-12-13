import { EventEmitter } from "node:events";
import { Prisma } from "@prisma/client";
import type { AuditAction, AuditLog, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export type AuditMetadata = Prisma.InputJsonValue;

const AUDIT_EVENT = "audit-log-created";

class AuditLogEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }
}

export const auditLogEmitter = new AuditLogEmitter();

export async function recordAuditLog(
  params: {
    action: AuditAction;
    actorId?: string | null;
    actorEmail?: string | null;
    actorName?: string | null;
    organizationId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: AuditMetadata;
  },
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  try {
    const log = await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        actorName: params.actorName ?? null,
        organizationId: params.organizationId ?? "org-default",
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: params.metadata ?? Prisma.DbNull
      }
    });

    auditLogEmitter.emit(AUDIT_EVENT, log satisfies AuditLog);
  } catch (error) {
    // avoid crashing request if audit fails
    console.error("Failed to record audit log", error);
  }
}

export function onAuditLogCreated(listener: (log: AuditLog) => void) {
  auditLogEmitter.on(AUDIT_EVENT, listener);
  return () => auditLogEmitter.off(AUDIT_EVENT, listener);
}
