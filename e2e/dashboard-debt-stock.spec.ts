import { expect, test } from "@playwright/test";

async function returnToDashboard(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
}

test("trennt einen illustrativen Schuldenbestand von jährlichen Saldoänderungen", async ({ page }) => {
  await page.goto("./#/dashboard");
  const dashboard = page.locator(".desktop-dashboard");
  await dashboard.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await page.getByRole("button", { name: "Baseline wiederherstellen", exact: true }).click();
  await returnToDashboard(page);

  const debt = page.getByTestId("debt-stock-kpi");
  const chart = dashboard.getByTestId("budget-chart");
  await expect(debt.getByText("Schuldenstand · Beispiel", { exact: true })).toBeVisible();
  await expect(debt.getByText("2.634,0 Mrd. €", { exact: true })).toBeVisible();
  await expect(debt.getByText("keine Fortschreibung", { exact: true })).toBeVisible();
  await expect(debt).toContainText("ohne belegten Stichtag");
  await expect(debt).toContainText("keine Schuldenprognose");
  await expect(debt).not.toContainText(/BIP|62,1 %|± 4 %/);
  await expect(page.locator(".sticky-kpis").getByText("Saldo pro Jahr", { exact: true })).toBeVisible();
  await expect(dashboard.getByText("Werte in Mrd. € pro Jahr")).toBeVisible();
  const unchangedDebtValue = await debt.locator(".kpi-value-row strong").innerText();

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("30");
  await returnToDashboard(page);
  await expect(dashboard.getByTestId("budget-chart").getByTestId("budget-chart-column").nth(1)).toHaveAttribute("data-direction", "positive");
  await expect(debt.locator(".kpi-value-row strong")).toHaveText(unchangedDebtValue);
  await expect(debt.locator(".kpi-value-row em")).toHaveText("keine Fortschreibung");
  await page.screenshot({ path: "test-results/issue-100-debt-stock-better-saldo.png", fullPage: true });

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("18");
  await returnToDashboard(page);
  await expect(dashboard.getByTestId("budget-chart").getByTestId("budget-chart-column").nth(1)).toHaveAttribute("data-direction", "negative");
  await expect(debt.locator(".kpi-value-row strong")).toHaveText(unchangedDebtValue);
  await expect(debt.locator(".kpi-value-row em")).toHaveText("keine Fortschreibung");
  await page.screenshot({ path: "test-results/issue-100-debt-stock-worse-saldo.png", fullPage: true });

  const evidence = debt.getByRole("button");
  await evidence.focus();
  await expect(evidence).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Nachweis: Öffentlicher Schuldenstand (Beispielwert)" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Annahme");
  await expect(drawer.locator("footer")).toContainText("Datenstand nicht belegt");
  await expect(drawer).toContainText("Kein belastbarer Referenzstand");
  await page.screenshot({ path: "test-results/issue-100-debt-stock-evidence.png", fullPage: true });
});

test("ordnet den Beispielbestand mobil ein und zeigt keinen festen Schuldenpfad", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/dashboard");
  const debt = page.getByTestId("debt-stock-kpi");
  await expect(debt.getByText("Schuldenstand · Beispiel", { exact: true })).toBeVisible();
  await expect(debt).toContainText("ohne belegten Stichtag");
  await expect(debt.getByText("keine Fortschreibung", { exact: true })).toBeVisible();
  const pageWidths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(pageWidths.page).toBeLessThanOrEqual(pageWidths.viewport);
  await page.screenshot({ path: "test-results/issue-100-debt-stock-mobile.png", fullPage: true });
});
