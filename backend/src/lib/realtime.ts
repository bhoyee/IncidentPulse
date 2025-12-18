import { EventEmitter } from "node:events";
import type { Incident } from "@prisma/client";
import type { StatusSnapshot } from "./status";

export type IncidentRealtimePayload = {
  id: string;
  title: string;
  severity: Incident["severity"];
  status: Incident["status"];
  organizationId?: string;
  service: {
    id: string;
    name: string;
    slug: string;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

export type IncidentRealtimeEvent =
  | { type: "incident.created" | "incident.updated"; incident: IncidentRealtimePayload }
  | { type: "incident.deleted"; incidentId: string };

export type SupportRealtimeEvent =
  | {
      type:
        | "support.ticket.created"
        | "support.ticket.updated"
        | "support.comment.added"
        | "support.ticket.deleted";
      ticket: {
        id: string;
        organizationId: string;
        updatedAt: Date;
      };
    };

const incidentEmitter = new EventEmitter();
incidentEmitter.setMaxListeners(0);

export function emitIncidentEvent(event: IncidentRealtimeEvent) {
  incidentEmitter.emit("incident", event);
}

export function onIncidentEvent(listener: (event: IncidentRealtimeEvent) => void) {
  incidentEmitter.on("incident", listener);
  return () => incidentEmitter.off("incident", listener);
}

const supportEmitter = new EventEmitter();
supportEmitter.setMaxListeners(0);

export function emitSupportEvent(event: SupportRealtimeEvent) {
  supportEmitter.emit("support", event);
}

export function onSupportEvent(listener: (event: SupportRealtimeEvent) => void) {
  supportEmitter.on("support", listener);
  return () => supportEmitter.off("support", listener);
}

const statusEmitter = new EventEmitter();
statusEmitter.setMaxListeners(0);

export function emitStatusSnapshot(snapshot: StatusSnapshot) {
  statusEmitter.emit("status", snapshot);
}

export function onStatusSnapshot(listener: (snapshot: StatusSnapshot) => void) {
  statusEmitter.on("status", listener);
  return () => statusEmitter.off("status", listener);
}
