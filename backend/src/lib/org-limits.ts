import { Plan } from "@prisma/client";

type Limits = {
  maxServices?: number;
  maxMembers?: number;
  maxIncidentsPerMonth?: number;
};

const LIMITS_BY_PLAN: Record<Plan, Limits> = {
  free: {
    maxServices: 2,
    maxMembers: 3,
    maxIncidentsPerMonth: 50
  },
  pro: {
    maxServices: 20,
    maxMembers: 25,
    maxIncidentsPerMonth: 1000
  },
  enterprise: {
    maxServices: undefined,
    maxMembers: undefined,
    maxIncidentsPerMonth: undefined
  }
};

export function getPlanLimits(plan: Plan): Limits {
  return LIMITS_BY_PLAN[plan] ?? LIMITS_BY_PLAN.free;
}
