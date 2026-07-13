import { expect, test } from "@playwright/test";

test("kennzeichnet Dashboardzustände eindeutig", async ({ page, isMobile }) => {
  await page.goto("./#/dashboard");

  if (isMobile) {
    await page.getByRole("tab", { name: "Steuern" }).click();
  }

  let revenuePanel = page.getByRole("complementary", { name: "Einnahmen" });
  await revenuePanel.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("20");
  await page.getByRole("button", { name: "Zurück zum Dashboard" }).click();

  if (isMobile) {
    await page.getByRole("tab", { name: "Steuern" }).click();
  }

  revenuePanel = page.getByRole("complementary", { name: "Einnahmen" });
  const tradeTaxRow = revenuePanel.locator("li").filter({ hasText: "Gewerbesteuer" });
  const tradeTaxButton = tradeTaxRow.locator(".line-row-main");
  const wealthTaxRow = revenuePanel.locator("li").filter({ hasText: "Vermögensteuer" });
  const changedTaxRow = revenuePanel.locator("li").filter({ hasText: "Umsatzsteuer" });

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

  await expect(changedTaxRow).toHaveClass(/changed/);
  const changedBackground = await changedTaxRow.evaluate((element) => getComputedStyle(element).backgroundColor);
  const neutralBackground = await wealthTaxRow.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(changedBackground).not.toBe(neutralBackground);

  if (!isMobile) {
    await wealthTaxRow.locator(".line-side em").hover();
    await page.waitForTimeout(200);
    const hoverBackground = await wealthTaxRow.evaluate((element) => getComputedStyle(element).backgroundColor);
    const buttonBackground = await wealthTaxRow.locator(".line-row-main").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(hoverBackground).not.toBe(neutralBackground);
    expect(hoverBackground).not.toBe(changedBackground);
    expect(buttonBackground).toBe("rgba(0, 0, 0, 0)");

    await changedTaxRow.locator(".line-row-main").hover();
    await page.waitForTimeout(200);
    const changedHoverBackground = await changedTaxRow.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(changedHoverBackground).not.toBe(changedBackground);
    expect(changedHoverBackground).not.toBe(hoverBackground);

    await wealthTaxRow.locator(".line-side em").hover();
    await page.waitForTimeout(200);
  }

  if (isMobile) {
    await page.getByRole("tab", { name: "Ausgaben" }).click();
  }

  const expensePanel = page.getByRole("complementary", { name: "Ausgaben" });
  const internalSecurityRow = expensePanel.locator("li").filter({ hasText: "Innere Sicherheit" });
  await expect(internalSecurityRow.locator(".line-row-main")).toBeDisabled();
  expect(await internalSecurityRow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("repeating-linear-gradient");

  if (!isMobile) {
    await page.screenshot({ path: "test-results/dashboard-disabled-items.png", fullPage: true });
  }
});
