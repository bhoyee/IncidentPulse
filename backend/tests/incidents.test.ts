jest.mock("../src/lib/db", () => require("./__mocks__/prismaClient"));

import { buildApp } from "../src/app";
import { prisma } from "./__mocks__/prismaClient";

describe("Incident routes", () => {
  it("creates a new incident when user is operator", async () => {
    const fastify = buildApp();
    await fastify.ready();

    const token = fastify.jwt.sign({
      id: "operator-1",
      role: "operator",
      email: "ops@example.com",
      name: "Ops"
    });

    (prisma.incident.create as jest.Mock).mockResolvedValue({
      id: "incident-1",
      title: "API outage",
      severity: "high",
      status: "open",
      description: "Customers cannot reach API",
      createdById: "operator-1",
      firstResponseAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/incidents",
      payload: {
        title: "API outage",
        severity: "high",
        description: "Customers cannot reach API"
      },
      cookies: {
        incidentpulse_session: token
      }
    });

    expect(prisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "operator-1"
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
