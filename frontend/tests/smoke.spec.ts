import { test, expect } from "@playwright/test";

test("status page renders public information", async ({ page }) => {
  await page.route("**/public/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: false,
        data: {
          overall_state: "operational",
          services: [
            { name: "API", state: "operational" },
            { name: "Dashboard", state: "operational" }
          ],
          updated_at: new Date().toISOString()
        },
        meta: {
          state: "operational",
          uptime24h: 1
        }
      })
    });
  });

  await page.goto("/status");
  await expect(page.getByRole("heading", { name: /status/i })).toBeVisible();
  await expect(
    page.getByText(/All systems operational|Partial outage|Major outage/i)
  ).toBeVisible();
});
