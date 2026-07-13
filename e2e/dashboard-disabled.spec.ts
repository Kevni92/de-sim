import { expect, test } from "@playwright/test";

test("kennzeichnet nicht implementierte Einnahmen und Ausgaben als deaktiviert", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Dashboardzustand");

  await page.goto("./#/dashboard");

  const revenuePanel = page.getByRole("complementary", { name: "Einnahmen" });
  const tradeTaxRow = revenuePanel.locator("li").filter({ hasText: "Gewerbesteuer" });
  const tradeTaxButton = tradeTaxRow.locator(".line-row-main");
  const wealthTaxRow = revenuePanel.locator("li").filter({ hasText: "Vermögensteuer" });

  await expect(tradeTaxButton).toBeDisabled();
  expect(await tradeTaxRow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("repeating-linear-gradient");

  const disabledTextColor = await tradeTaxRow.locator(".line-copy strong").evaluate((element) => getComputedStyle(element).color);
  const enabledTextColor = await wealthTaxRow.locator(".line-copy strong").evaluate((element) => getComputedStyle(element).color);
  expect(disabledTextColor).not.toBe(enabledTextColor);

  const backgroundBeforeHover = await tradeTaxButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  await tradeTaxButton.hover({ force: true });
  const backgroundAfterHover = await tradeTaxButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(backgroundAfterHover).toBe(backgroundBeforeHover);

  await expect(wealthTaxRow.locator(".line-row-main")).toBeEnabled();
  await expect(wealthTaxRow).toHaveCSS("background-image", "none");

  const expensePanel = page.getByRole("complementary", { name: "Ausgaben" });
  const internalSecurityRow = expensePanel.locator("li").filter({ hasText: "Innere Sicherheit" });
  await expect(internalSecurityRow.locator(".line-row-main")).toBeDisabled();
  expect(await internalSecurityRow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("repeating-linear-gradient");

  await page.screenshot({ path: "test-results/dashboard-disabled-items.png", fullPage: true });
});
