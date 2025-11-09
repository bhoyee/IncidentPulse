export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "monitoring" | "resolved";

export type Incident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  createdById: string;
  assignedToId: string | null;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  categories: string[];
  impactScope: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
    teamRoles: string[];
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
    teamRoles: string[];
  } | null;
  service?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
  };
};

export type IncidentUpdate = {
  id: string;
  incidentId: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  message: string;
  createdAt: string;
};

export type MetricsResponse = {
  avgFirstResponseMinutesToday: number;
  avgResolveMinutesToday: number;
};

export type ServiceStatus = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  state: "operational" | "partial_outage" | "major_outage";
  activeIncidentCount: number;
};

export type StatusSnapshot = {
  overall_state: "operational" | "partial_outage" | "major_outage";
  active_incidents: Array<{
    id: string;
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    startedAt: string;
    service: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  services: ServiceStatus[];
  last_24h: {
    uptime_percent: number;
    incident_count: number;
  };
};
