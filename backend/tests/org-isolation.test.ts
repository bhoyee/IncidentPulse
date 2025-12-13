import request from "supertest";
import { prisma } from "../src/lib/db";
import { buildApp } from "../src/app";
import { hashPassword } from "../src/lib/auth";
import { DEFAULT_ORG_ID, ensureDefaultOrganization } from "../src/lib/org";

jest.setTimeout(20000);

describe("Org isolation smoke", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let server: any;
  let userAEmail: string;
  let userBEmail: string;

  beforeAll(async () => {
    app = await buildApp();
    // Seed two users/orgs for isolation checks with unique slugs to avoid existing data clashes.
    await ensureDefaultOrganization();
    const slugA = `orga-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const slugB = `orgb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orgA = await prisma.organization.create({
      data: { name: "Org A", slug: slugA, plan: "free" }
    });
    const orgB = await prisma.organization.create({
      data: { name: "Org B", slug: slugB, plan: "free" }
    });
    userAEmail = `a-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    userBEmail = `b-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const userA = await prisma.user.create({
      data: {
        email: userAEmail,
        name: "A",
        role: "admin",
        passwordHash: await hashPassword("password123"),
        isActive: true
      }
    });
    const userB = await prisma.user.create({
      data: {
        email: userBEmail,
        name: "B",
        role: "admin",
        passwordHash: await hashPassword("password123"),
        isActive: true
      }
    });
    await prisma.membership.createMany({
      data: [
        { id: `m-${userA.id}-${orgA.id}`, userId: userA.id, organizationId: orgA.id, role: "owner" },
        { id: `m-${userB.id}-${orgB.id}`, userId: userB.id, organizationId: orgB.id, role: "owner" }
      ]
    });
    server = app.server;
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function login(email: string, password: string) {
    const res = await request(server).post("/auth/login").send({ email, password });
    return res.headers["set-cookie"]?.[0];
  }

  it("prevents reading another org's incidents", async () => {
    const cookieA = await login(userAEmail, "password123");
    const cookieB = await login(userBEmail, "password123");

    // user A creates incident in orgA
    const createRes = await request(server)
      .post("/incidents")
      .set("Cookie", cookieA)
      .send({ title: "Incident A", severity: "medium", description: "test" });
    expect(createRes.status).toBeLessThan(300);
    const incidentId = createRes.body.data?.id;

    // user B cannot see it
    const listB = await request(server).get("/incidents").set("Cookie", cookieB);
    expect(listB.status).toBe(200);
    const idsB = (listB.body?.data ?? []).map((i: any) => i.id);
    expect(idsB).not.toContain(incidentId);
  });

  it("allows org switch only for memberships", async () => {
    const cookieA = await login(userAEmail, "password123");
    const switchRes = await request(server)
      .post("/organizations/switch")
      .set("Cookie", cookieA)
      .send({ organizationId: DEFAULT_ORG_ID });
    expect([200, 403]).toContain(switchRes.status); // default org may not have membership

    const failSwitch = await request(server)
      .post("/organizations/switch")
      .set("Cookie", cookieA)
      .send({ organizationId: "00000000-0000-0000-0000-000000000000" });
    expect([400, 403]).toContain(failSwitch.status);
  });
});
