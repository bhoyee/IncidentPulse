jest.mock("../src/lib/db", () => require("./__mocks__/prismaClient"));

import { buildApp } from "../src/app";
import { prisma, resetPrismaMock } from "./__mocks__/prismaClient";

describe("Incident routes", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("creates a new incident when user is operator", async () => {
    const fastify = buildApp();
    await fastify.ready();

    const orgId = "11111111-1111-1111-1111-111111111111";
    const serviceId = "22222222-2222-2222-2222-222222222222";
    const token = fastify.jwt.sign({
      id: "operator-1",
      role: "operator",
      email: "ops@example.com",
      name: "Ops",
      orgId,
      membershipRole: "owner"
    });

    // Seed data into the mock store instead of overriding methods
    await prisma.user.create({
      data: {
        id: "operator-1",
        email: "ops@example.com",
        name: "Ops",
        role: "operator",
        isActive: true
      }
    });

    // Create the org referenced in the test
    await prisma.organization.create({
      data: {
        id: orgId,
        name: "Test Org",
        slug: "test-org"
      }
    });

    await prisma.membership.create({
      data: {
        id: "membership-1",
        userId: "operator-1",
        organizationId: orgId,
        role: "owner"
      }
    });

    await prisma.service.create({
      data: {
        id: serviceId,
        name: "API",
        slug: "api",
        organizationId: orgId
      }
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/incidents",
      payload: {
        title: "API outage",
        severity: "high",
        description: "Customers cannot reach API",
        serviceId
      },
      cookies: {
        incidentpulse_session: token
      }
    });

    expect(prisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "operator-1",
          organizationId: orgId
        })
      })
    );

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.error).toBe(false);
    expect(body.data.title).toBe("API outage");

    await fastify.close();
  });
});
