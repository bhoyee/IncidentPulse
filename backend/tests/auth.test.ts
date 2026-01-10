jest.mock("../src/lib/db", () => require("./__mocks__/prismaClient"));

import bcrypt from "bcryptjs";
import { buildApp } from "../src/app";
import { prisma, resetPrismaMock } from "./__mocks__/prismaClient";

describe("Auth routes", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("logs in a user with valid credentials", async () => {
    const fastify = buildApp();

    const passwordHash = await bcrypt.hash("strong-password", 12);
    
    // Seed user in mock store
    await prisma.user.create({
      data: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
        isActive: true,
        passwordHash
      }
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "strong-password"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.cookies[0]).toBeDefined();

    const body = response.json();
    expect(body.error).toBe(false);
    expect(body.user.email).toBe("admin@example.com");

    await fastify.close();
  });

  it("rejects invalid credentials", async () => {
    const fastify = buildApp();

    // No user created, so findUnique returns null by default from mock

    const response = await fastify.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "missing@example.com",
        password: "wrong-password"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe(true);
    expect(body.message).toBe("Invalid credentials");

    await fastify.close();
  });
});
