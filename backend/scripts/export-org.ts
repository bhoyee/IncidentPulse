import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import "../tests/test-env";

type CliArgs = {
  orgId?: string;
  out?: string;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--org" || arg === "--orgId") {
      parsed.orgId = args[i + 1];
      i++;
    } else if (arg === "--out") {
      parsed.out = args[i + 1];
      i++;
    }
  }
  return parsed;
}

async function main() {
  const { orgId, out } = parseArgs();
  if (!orgId) {
    throw new Error("Usage: tsx scripts/export-org.ts --org <orgId> [--out ./export.json]");
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: { include: { user: true } },
      services: true,
      incidents: {
        include: {
          updates: true
        }
      },
      maintenanceEvents: true,
      apiKeys: true,
      integrationSettings: true,
      inviteTokens: true
    }
  });
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const payload = {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt
    },
    memberships: org.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      user: {
        id: m.user.id,
        email: m.user.email,
        name: m.user.name
      }
    })),
    services: org.services,
    incidents: org.incidents,
    maintenanceEvents: org.maintenanceEvents,
    apiKeys: org.apiKeys.map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
    integrationSettings: org.integrationSettings,
    invites: org.inviteTokens
  };

  const outputPath = out ? path.resolve(out) : path.resolve(process.cwd(), `org-${org.slug || org.id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Exported org ${orgId} to ${outputPath}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
