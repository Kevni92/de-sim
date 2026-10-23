import { expect, test, type Locator } from "@playwright/test";

async function readChartState(chart: Locator, columnIndex: number) {
  const column = chart.getByTestId("budget-chart-column").nth(columnIndex);
  const bar = column.getByTestId("budget-chart-bar");
  const plot = column.locator(".budget-chart-plot");
  const [value, scale, barBox, plotBox] = await Promise.all([
    column.getAttribute("data-value").then(Number),
    chart.getAttribute("data-scale").then(Number),
    bar.boundingBox(),
    plot.boundingBox(),
  ]);
  if (!barBox || !plotBox) throw new Error("Budgetdiagramm ist nicht sichtbar.");
  return { column, bar, value, scale, barHeight: barBox.height, plotHeight: plotBox.height, barTop: barBox.y, barBottom: barBox.y + barBox.height };
}

async function expectLinearScale(chart: Locator, columnIndex: number) {
  const state = await readChartState(chart, columnIndex);
  const expectedHeight = state.scale === 0 ? 0 : Math.abs(state.value) / state.scale * 0.44;
  expect(state.barHeight / state.plotHeight).toBeCloseTo(expectedHeight, 2);
  return state;
}

async function returnToDashboard(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
}

test("stellt Nullwerte, positive und negative Budgetwirkungen proportional zur Nullachse dar", async ({ page }) => {
  await page.goto("./#/dashboard");
  const dashboard = page.locator(".desktop-dashboard");
  await dashboard.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await page.getByRole("button", { name: "Baseline wiederherstellen", exact: true }).click();
  await page.getByRole("button", { name: "Zurück zum Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  const chart = dashboard.getByTestId("budget-chart");
  await expect(dashboard.getByRole("heading", { name: "Budgetsaldo und Änderungen" })).toBeVisible();
  await expect(dashboard.getByText("Werte in Mrd. € pro Jahr")).toBeVisible();
  await expect(chart.getByTestId("budget-chart-column")).toHaveCount(4);
  await expect(chart.locator('.budget-chart-bar[data-value="0"]')).toHaveCount(1);
  await expect(chart.getByText("Einnahmenwirkung", { exact: true })).toBeVisible();
  await expect(chart.getByText("Ausgabenwirkung auf Saldo", { exact: true })).toBeVisible();
  const zeroLine = await chart.locator(".budget-chart-zero-line").boundingBox();
  const zeroBar = await readChartState(chart, 2);
  expect(zeroBar.barHeight).toBe(0);
  expect(zeroLine).not.toBeNull();
  await page.screenshot({ path: "test-results/issue-99-budget-zero.png", fullPage: true });

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  const standardRate = page.getByLabel("Regelsteuersatz Wert");
  await standardRate.fill("20");
  await standardRate.press("Enter");
  await expect(page.getByTestId("revenue-module-value")).toHaveText("+13,1 Mrd. €");
  await returnToDashboard(page);
  const revenue = await expectLinearScale(dashboard.getByTestId("budget-chart"), 1);
  expect(revenue.value).toBeGreaterThan(0);
  expect(revenue.column).toHaveAttribute("data-direction", "positive");
  const positiveZeroY = (await dashboard.getByTestId("budget-chart").locator(".budget-chart-zero-line").boundingBox())!.y;
  expect(revenue.barBottom).toBeLessThanOrEqual(positiveZeroY + 1);
  await page.screenshot({ path: "test-results/issue-99-budget-positive.png", fullPage: true });

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await standardRate.fill("21");
  await standardRate.press("Enter");
  await returnToDashboard(page);
  const doubled = await expectLinearScale(dashboard.getByTestId("budget-chart"), 1);
  expect(doubled.value).toBeGreaterThan(revenue.value);

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await standardRate.fill("18");
  await standardRate.press("Enter");
  await returnToDashboard(page);
  const negative = await expectLinearScale(dashboard.getByTestId("budget-chart"), 1);
  expect(negative.value).toBeLessThan(0);
  expect(negative.column).toHaveAttribute("data-direction", "negative");
  const negativeZeroY = (await dashboard.getByTestId("budget-chart").locator(".budget-chart-zero-line").boundingBox())!.y;
  expect(negative.barTop).toBeGreaterThanOrEqual(negativeZeroY - 1);
  await page.screenshot({ path: "test-results/issue-99-budget-negative.png", fullPage: true });

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await standardRate.fill("30");
  await standardRate.press("Enter");
  await returnToDashboard(page);
  const large = await expectLinearScale(dashboard.getByTestId("budget-chart"), 1);
  expect(large.value).toBeGreaterThan(doubled.value);
  expect(large.barHeight).toBeGreaterThan(negative.barHeight);
  await page.screenshot({ path: "test-results/issue-99-budget-large.png", fullPage: true });
});

test("ersetzt den erfundenen Zeitpfad durch einen zugänglichen Einstieg in die Langfristansicht", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/dashboard");
  const mobile = page.locator(".mobile-dashboard");
  const budgetChart = mobile.getByTestId("budget-chart");
  await expect(mobile.getByRole("heading", { name: "Budgetsaldo und Änderungen" })).toBeVisible();
  await expect(budgetChart.getByTestId("budget-chart-column")).toHaveCount(4);
  const pageWidths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(pageWidths.page).toBeLessThanOrEqual(pageWidths.viewport);
  await page.screenshot({ path: "test-results/issue-99-budget-mobile.png", fullPage: true });
  await mobile.getByRole("button", { name: "Zeitverlauf", exact: true }).click();
  const timeSummary = mobile.locator(".time-summary");
  await expect(timeSummary.getByRole("heading", { name: "Ein Jahreswert, keine Fortschreibung" })).toBeVisible();
  await expect(timeSummary.getByText("Änderung des jährlichen Saldos der ausgewiesenen Posten")).toBeVisible();
  await expect(timeSummary.locator(".time-chart")).toHaveCount(0);
  const openLongTerm = timeSummary.getByRole("button", { name: "Langfristansicht öffnen" });
  await expect(openLongTerm).toBeVisible();
  await page.screenshot({ path: "test-results/issue-99-time-summary-mobile.png", fullPage: true });

  const tab = mobile.getByRole("button", { name: "Zeitverlauf", exact: true });
  await tab.focus();
  for (let attempt = 0; attempt < 3 && !(await openLongTerm.evaluate((element) => element === document.activeElement)); attempt += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(openLongTerm).toBeFocused();
  await expect(openLongTerm).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/langfrist$/);
  await expect(page.getByLabel("Zieljahr", { exact: true })).toBeVisible();
});
