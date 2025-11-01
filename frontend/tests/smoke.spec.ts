import { test, expect } from "@playwright/test";

test("status page renders public information", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: /status/i })).toBeVisible();
  await expect(
    page.getByText(/All systems operational|Partial outage|Major outage/i)
  ).toBeVisible();
});
