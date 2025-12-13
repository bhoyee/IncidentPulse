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

const incidentEmitter = new EventEmitter();
incidentEmitter.setMaxListeners(0);

export function emitIncidentEvent(event: IncidentRealtimeEvent) {
  incidentEmitter.emit("incident", event);
}

export function onIncidentEvent(listener: (event: IncidentRealtimeEvent) => void) {
  incidentEmitter.on("incident", listener);
  return () => incidentEmitter.off("incident", listener);
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
