import { expect, test } from "@playwright/test";

test("verwendet für Einnahmen- und Ausgabendetails dasselbe Seitenmuster", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Layoutvergleich");

  await page.goto("./#/einnahmen");
  const revenueHeader = page.locator(".module-page-header");
  const revenueSummary = page.locator(".revenue-module-summary");
  await expect(revenueHeader.getByRole("button", { name: "Zurück zum Dashboard" })).toBeVisible();
  await expect(revenueSummary.getByRole("button", { name: "Berechnung und Quellen" })).toBeVisible();
  await expect(revenueSummary.getByRole("button", { name: "Baseline wiederherstellen" })).toBeVisible();
  await expect(revenueHeader.getByRole("button", { name: "Berechnung und Quellen" })).toHaveCount(0);

  await page.locator(".revenue-module-list").getByRole("button", { name: /Einkommensteuer/ }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.locator(".module-page-header").getByRole("heading", { name: "Steuern und Sozialbeiträge" })).toBeVisible();
  await expect(page.locator(".revenue-module-summary").getByRole("button", { name: "Baseline wiederherstellen" })).toBeVisible();

  await page.goto("./#/ausgaben");
  await expect(page.locator(".module-page-header").getByRole("heading", { name: "Ausgaben und Leistungen" })).toBeVisible();
  await expect(page.locator(".revenue-module-summary").getByRole("button", { name: "Berechnung und Quellen" })).toBeVisible();

  await page.goto("./#/einnahmen");
  await page.screenshot({ path: "test-results/detail-mask-alignment.png", fullPage: true });
});
