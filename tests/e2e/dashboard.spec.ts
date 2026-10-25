import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const screenshots = process.env.QA_SCREENSHOTS;
test("light default, persistent theme, filters, details, and CSV export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?demo=1");
  await expect(
    page.getByText("Simulated locally.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".event-table tbody tr").first()).toBeVisible();
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/desktop-light.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/desktop-dark.png`,
      fullPage: true,
    });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Application", { exact: true }).selectOption("demo-3");
  await expect(page.locator(".service-row")).toHaveCount(1);
  await page.getByLabel("Search events").fill("not-a-real-event");
  await expect(
    page.getByRole("heading", { name: "No matching events" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".service-row")).toHaveCount(5);
  await page.locator(".event-link").first().click();
  await expect(
    page.getByRole("dialog", { name: "Event details" }),
  ).toBeVisible();
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/event-dialog.png`,
      fullPage: true,
    });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export loaded" }).click();
  expect((await download).suggestedFilename()).toBe(
    "DEMO-watchtower-loaded-events.csv",
  );
  await page.getByRole("button", { name: "Acknowledge (demo)" }).click();
  await expect(page.locator(".incident .status-badge")).toHaveText(
    "acknowledged",
  );
  expect(errors).toEqual([]);
});
test("mobile layouts and accessible controls in both themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1");
  await expect(page.locator(".service-row")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/mobile-light.png`,
      fullPage: true,
    });
  const light = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    light.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/mobile-dark.png`,
      fullPage: true,
    });
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    dark.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("real API failures never silently substitute demo data", async ({
  page,
}) => {
  await page.route("**/v1/dashboard/snapshot?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "authentication_not_configured" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "authentication not configured",
  );
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.locator(".service-row")).toHaveCount(0);
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/api-error.png`,
      fullPage: true,
    });
});
test("application creation and reported telemetry work through the real local API", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.LIVE_API_TEST,
    "Start the local Worker and set LIVE_API_TEST=1.",
  );
  await page.goto("/");
  await expect(
    page.getByText("API connected · polling", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  const name = `Local test API ${Date.now()}`;
  await page.getByLabel("Application name").fill(name);
  await page
    .getByRole("button", { name: "Create application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Application created" }),
  ).toBeVisible();
  const credential = await page
    .getByLabel("Ingestion credential shown once")
    .inputValue();
  const result = await request.post("/v1/ingest/events", {
    headers: { Authorization: `Bearer ${credential}` },
    data: {
      events: [
        {
          eventId: `local-check-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          type: "check",
          severity: "info",
          statusCode: 200,
          latencyMs: 24,
          message: "[LOCAL TEST] Check completed",
        },
      ],
    },
  });
  expect(result.status()).toBe(202);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const service = page.locator(".service-row").filter({ hasText: name });
  await expect(service).toContainText("healthy");
  await expect(page.locator(".demo-banner")).toHaveCount(0);
});
