const prismaMock = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  },
  incident: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  incidentUpdate: {
    create: jest.fn()
  },
  statusCache: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  },
  $transaction: jest.fn().mockImplementation(async (operations: Array<Promise<unknown>>) => {
    return Promise.all(operations);
  }),
  $queryRaw: jest.fn()
};

export const prisma = prismaMock;

export const databaseHealthCheck = jest.fn();

export function resetPrismaMock() {
  for (const key of Object.keys(prismaMock) as Array<keyof typeof prismaMock>) {
    const value = prismaMock[key];
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
      continue;
    }

    if (typeof value === "object") {
      for (const nestedKey of Object.keys(value)) {
        const nestedValue = (value as Record<string, unknown>)[nestedKey];
        if (nestedValue && typeof nestedValue === "function" && "mockReset" in nestedValue) {
          (nestedValue as jest.Mock).mockReset();
        }
      }
    }
  }
  databaseHealthCheck.mockReset();
}
