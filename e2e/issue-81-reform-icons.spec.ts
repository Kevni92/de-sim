import { expect, test } from "@playwright/test";

test("zeigt die fachlichen Icons mit sichtbarer Text- und Farbsemantik", async ({ page, isMobile }) => {
  await page.goto("./#/einnahmen");

  const moduleList = page.locator(".revenue-module-list");
  const moduleButtons = moduleList.locator("nav > button");
  await expect(moduleButtons).toHaveCount(8);
  await expect(page.getByTestId("reform-kpi-grid")).toBeVisible({ timeout: 45_000 });

  const expectedModuleIcons = [
    { name: "incomeTax", label: "Einkommensteuer" },
    { name: "valueAddedTax", label: "Umsatzsteuer" },
    { name: "inheritanceTax", label: "Erbschaft- und Schenkungsteuer" },
    { name: "wealthTax", label: "Vermögensteuer" },
    { name: "socialContributions", label: "Sozialversicherungsbeiträge" },
    { name: "corporateTax", label: "Körperschaftsteuer" },
    { name: "capitalIncomeTax", label: "Kapitalertragsteuer" },
    { name: "energyTax", label: "Energie- und Verbrauchsteuern" },
  ];
  for (const [index, { name, label }] of expectedModuleIcons.entries()) {
    const button = moduleButtons.nth(index);
    const icon = button.locator("svg[data-reform-icon]");
    await expect(icon).toHaveAttribute("data-reform-icon", name);
    await expect(icon).toHaveAttribute("width", "20");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveAttribute("focusable", "false");
    await expect(button).toContainText(label);
  }

  const summary = page.locator(".reform-result-layout");
  const titleIcon = summary.locator(".module-summary-title svg[data-reform-icon]");
  await expect(titleIcon).toHaveAttribute("data-reform-icon", "valueAddedTax");
  await expect(titleIcon).toHaveAttribute("width", "24");

  const metricIcons = summary.getByTestId("reform-kpi-grid").locator("svg[data-reform-icon]");
  await expect(metricIcons).toHaveCount(4);
  for (const [index, name] of ["baseline", "directEffect", "affectedGroup", "confidence"].entries()) {
    await expect(metricIcons.nth(index)).toHaveAttribute("data-reform-icon", name);
    await expect(metricIcons.nth(index)).toHaveAttribute("width", "16");
    await expect(metricIcons.nth(index)).toHaveAttribute("aria-hidden", "true");
  }
  await expect(metricIcons.nth(0)).toHaveClass(/reform-visual-neutral/);
  await expect(metricIcons.nth(1)).toHaveClass(/reform-visual-(positive|negative)/);
  await expect(metricIcons.nth(2)).toHaveClass(/reform-visual-affected/);
  await expect(metricIcons.nth(3)).toHaveClass(/reform-visual-(information|caution)/);

  const allReformIcons = page.locator("svg[data-reform-icon]");
  await expect(allReformIcons).toHaveCount(14);
  const iconAttributes = await allReformIcons.evaluateAll((icons) => icons.map((icon) => ({
    viewBox: icon.getAttribute("viewBox"),
    stroke: icon.getAttribute("stroke"),
    strokeWidth: icon.getAttribute("stroke-width"),
    linecap: icon.getAttribute("stroke-linecap"),
    linejoin: icon.getAttribute("stroke-linejoin"),
  })));
  expect(iconAttributes.every((icon) => icon.viewBox === "0 0 24 24" && icon.stroke === "currentColor" && icon.strokeWidth === "1.75" && icon.linecap === "round" && icon.linejoin === "round")).toBe(true);

  const reset = summary.getByRole("button", { name: "Baseline wiederherstellen" });
  await reset.focus();
  await expect(reset).toBeFocused();
  await expect(reset.locator("svg[data-reform-icon]")).toHaveAttribute("data-reform-icon", "resetBaseline");
  await page.keyboard.press("Enter");
  await expect(reset).toBeFocused();

  const wealthButton = moduleButtons.filter({ hasText: "Vermögensteuer" });
  await wealthButton.click();
  await expect(titleIcon).toHaveAttribute("data-reform-icon", "wealthTax");
  await expect(wealthButton).toHaveAttribute("aria-current", "page");

  if (isMobile) {
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth);
    await page.screenshot({ path: "test-results/issue-81-reform-icons-mobile.png", fullPage: true });
  } else {
    await page.screenshot({ path: "test-results/issue-81-reform-icons-desktop.png", fullPage: true });
  }
});
