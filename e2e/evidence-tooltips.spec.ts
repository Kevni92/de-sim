import { expect, test } from "@playwright/test";

test("zeigt Quellen- und Konfidenzvorschauen per Hover und Tastatur", async ({ page, isMobile }) => {
  await page.goto("./#/dashboard");

  if (isMobile) {
    await page.getByRole("tab", { name: "Steuern" }).click();
  }

  const revenuePanel = page.getByRole("complementary", { name: "Einnahmen" });
  const sourceButton = revenuePanel.getByRole("button", { name: "Quelle für Einnahmen" });
  await sourceButton.focus();

  const sourceTooltip = page.getByRole("tooltip");
  await expect(sourceTooltip).toBeVisible();
  await expect(sourceTooltip).toContainText("Grundlage");
  await expect(sourceTooltip).toContainText("Unsicherheit");
  await expect(sourceTooltip).toContainText("Daten");
  await expect(sourceTooltip).toContainText("Recht");

  const incomeTaxRow = revenuePanel.locator("li").filter({ hasText: "Einkommensteuer" });
  const confidence = incomeTaxRow.getByRole("img", { name: /Belastbarkeit/ });
  await confidence.focus();

  const confidenceTooltip = page.getByRole("tooltip");
  await expect(confidenceTooltip).toContainText("Belastbarkeit:");
  await expect(confidenceTooltip).toContainText("3 = hoch · 2 = mittel · 1 = niedrig");

  if (!isMobile) {
    await page.screenshot({ path: "test-results/evidence-tooltips.png", fullPage: true });
  }
});
