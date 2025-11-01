import { resetPrismaMock } from "./__mocks__/prismaClient";

process.env.JWT_SECRET = "test-secret-1234567890";
process.env.FRONTEND_URL = "http://localhost:3040";
process.env.COOKIE_DOMAIN = "localhost";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/test";
process.env.PORT = "0";

afterEach(() => {
  resetPrismaMock();
});
