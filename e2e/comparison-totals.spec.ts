import { expect, test, type Page } from "@playwright/test";

test.setTimeout(210_000);

async function dashboardValue(page: Page, label: string) {
  const card = page.locator(".kpi-card").filter({ hasText: label });
  await expect(card).toBeVisible();
  return (await card.locator(".kpi-value-row strong").innerText()).trim();
}

async function compareDashboardValue(page: Page, rowId: string, label: string) {
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  const expected = await dashboardValue(page, label);
  await page.getByRole("button", { name: "Vergleich öffnen" }).click();
  const row = page.getByTestId(`comparison-${rowId}`);
  await expect(row.getByTestId("scenario-a-value")).toHaveText(expected);
  return expected;
}

test("hält Übersicht und Vergleich für unveränderte, Einnahmen-, Ausgaben- und Mischpakete konsistent", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Interaktionen; mobile Tabelle wird im selben Ablauf geprüft");
  await page.goto("./#/dashboard");
  const baselineRevenue = await dashboardValue(page, "Einnahmen");
  const baselineExpense = await dashboardValue(page, "Ausgaben");
  const baselineBalance = await dashboardValue(page, "Saldo");

  await page.getByRole("button", { name: "Vergleich öffnen" }).click();
  await expect(page.getByTestId("comparison-revenue").getByTestId("scenario-a-value")).toHaveText(baselineRevenue);
  await expect(page.getByTestId("comparison-expense").getByTestId("scenario-a-value")).toHaveText(baselineExpense);
  await expect(page.getByTestId("comparison-balance").getByTestId("scenario-a-value")).toHaveText(baselineBalance);
  await expect(page.getByTestId("comparison-revenue")).toContainText("Nicht vergleichbar");
  await expect(page.getByRole("note").filter({ hasText: "keine vollständige Haushaltsrechnung" })).toBeVisible();
  await page.screenshot({ path: "test-results/issue-97-comparison-baseline-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Zurück zum Dashboard" }).click();
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("20");
  await expect(page.getByTestId("revenue-module-value")).toHaveText("+13,1 Mrd. €");
  const revenueOnlyValue = await compareDashboardValue(page, "revenue", "Einnahmen");
  await expect(page.getByTestId("comparison-expense").getByTestId("scenario-a-value")).toHaveText(baselineExpense);
  await expect(page.getByTestId("comparison-balance").getByTestId("scenario-a-value")).not.toHaveText(baselineBalance);
  expect(revenueOnlyValue).not.toBe(baselineRevenue);

  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("19");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await page.getByRole("button", { name: "Rente bearbeiten" }).click();
  await page.getByLabel("Rentenwert Wert").fill("105");
  const expenseOnlyValue = await compareDashboardValue(page, "expense", "Ausgaben");
  await expect(page.getByTestId("comparison-revenue").getByTestId("scenario-a-value")).toHaveText(baselineRevenue);
  await expect(page.getByTestId("comparison-balance").getByTestId("scenario-a-value")).not.toHaveText(baselineBalance);
  expect(expenseOnlyValue).not.toBe(baselineExpense);

  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("20");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await page.getByLabel("Grundfreibetrag Wert").fill("15000");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  const combinedRevenue = await dashboardValue(page, "Einnahmen");
  const combinedExpense = await dashboardValue(page, "Ausgaben");
  const combinedBalance = await dashboardValue(page, "Saldo");
  expect(combinedRevenue).not.toBe(baselineRevenue);
  expect(combinedExpense).not.toBe(baselineExpense);

  await page.getByRole("button", { name: "Vergleich öffnen" }).click();
  await expect(page.getByTestId("comparison-revenue").getByTestId("scenario-a-value")).toHaveText(combinedRevenue);
  await expect(page.getByTestId("comparison-expense").getByTestId("scenario-a-value")).toHaveText(combinedExpense);
  await expect(page.getByTestId("comparison-balance").getByTestId("scenario-a-value")).toHaveText(combinedBalance);
  await expect(page.getByText(/Modellstufe „Mit kurzfristigen Reaktionen“/)).toBeVisible();
  const effects = page.getByTestId("effect-level-comparison");
  const effectFreshness = await effects.getAttribute("data-status");
  if (effectFreshness !== "current") {
    const unavailableText = effectFreshness === "updating" ? "Wird aktualisiert" : "Nicht aktuell";
    const effectValues = effects.locator(".effect-compare-value.active-column > strong");
    await expect(effectValues).toHaveCount(7);
    await expect(effectValues.nth(0)).toHaveText(/^[±+−].* Mrd\. €$/);
    for (let index = 1; index < 7; index += 1) await expect(effectValues.nth(index)).toHaveText(unavailableText);
  }
  await page.screenshot({ path: "test-results/issue-97-comparison-mixed-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const totalsRegion = page.getByRole("region", { name: "Haushaltskennzahlen im Vergleich" });
  for (let attempt = 0; attempt < 60 && !(await totalsRegion.evaluate((element) => element === document.activeElement)); attempt += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(totalsRegion).toBeFocused();
  await expect(totalsRegion).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => totalsRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/issue-97-comparison-mobile.png", fullPage: true });
});
