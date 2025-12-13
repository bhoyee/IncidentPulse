// Usage: NODE_ENV=production DATABASE_URL=... node scripts/set-plan.js <orgId> <plan>
const { PrismaClient } = require("../node_modules/@prisma/client");

const orgId = process.argv[2];
const plan = process.argv[3] || "pro";

if (!orgId) {
  console.error("Usage: node scripts/set-plan.js <orgId> <plan>");
  process.exit(1);
}

const prisma = new PrismaClient();

(async () => {
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan }
  });
  console.log(`Updated org ${orgId} to plan ${plan}`);
})()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
