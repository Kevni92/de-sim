import { expect, test } from "@playwright/test";

test("ordnet ein Einnahmemodul nach dem gemeinsamen Reform- und Ergebnisvertrag", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Referenzansicht");
  await page.goto("./#/einnahmen");

  const summary = page.locator(".reform-result-layout");
  await expect(summary.getByText("Was wird geändert?", { exact: true })).toBeVisible();
  await expect(summary.getByLabel("Regelsteuersatz Wert")).toBeVisible();
  await expect(summary.getByTestId("reform-kpi-grid").locator("article")).toHaveCount(4);
  await expect(summary.getByText("Direkte staatliche Wirkung", { exact: true })).toBeVisible();
  await expect(summary.getByText("Am stärksten betroffen", { exact: true })).toBeVisible();
  await expect(summary.getByText("Belastbarkeit", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Berechnungsrahmen" })).toBeHidden();

  const affectedSection = page.getByTestId("reform-affected-section");
  const affected = affectedSection.locator("summary");
  await affected.focus();
  await affected.press("Enter");
  await expect(affectedSection.getByText("Private Haushalte", { exact: true })).toBeVisible();

  const followUpSection = page.getByTestId("reform-follow-up-section");
  const followUp = followUpSection.locator("summary");
  await followUp.focus();
  await followUp.press("Enter");
  await expect(followUpSection.getByRole("heading", { name: "Berechnungsrahmen" })).toBeVisible();
  await expect(followUpSection.getByText("Mit kurzfristigen Reaktionen", { exact: true })).toBeVisible();
  await expect(page.getByText("Modellierte Folgewirkung", { exact: true })).toBeVisible();

  await page.getByText("Erweiterte Parameter", { exact: true }).click();
  await expect(page.getByLabel("Ermäßigter Steuersatz Wert")).toBeVisible();
  await page.screenshot({ path: "test-results/issue-34-reform-result-layout-desktop.png", fullPage: true });
});

test("verwendet mobil dieselbe fachliche Reihenfolge ohne horizontale Pflichtnavigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile Referenzansicht");
  await page.goto("./#/einnahmen");

  await expect(page.getByText("Was wird geändert?", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Regelsteuersatz Wert")).toBeVisible();
  await expect(page.getByTestId("reform-kpi-grid").locator("article")).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  const affectedSection = page.getByTestId("reform-affected-section");
  await affectedSection.getByText("Wer ist betroffen?", { exact: true }).click();
  await expect(affectedSection.getByText("Private Haushalte", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/issue-34-reform-result-layout-mobile.png", fullPage: true });
});
