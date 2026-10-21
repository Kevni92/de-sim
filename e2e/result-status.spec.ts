import { expect, test } from "@playwright/test";

test("ordnet die Ergebnisse am Einstieg und in den zentralen Ansichten ein", async ({ page }) => {
  await page.goto("./");
  const guide = page.locator(".result-status-guide");
  await expect(guide).toContainText("Tarifberechnung");
  await expect(guide).toContainText("Modellschätzung");
  await expect(guide).toContainText("Beispielwert");
  await expect(guide).toContainText("Noch nicht berechnet");
  await expect(page.getByText(/Alle im Prototyp verwendeten Werte sind gerundete Demonstrationswerte/)).toHaveCount(0);
  await page.screenshot({ path: "test-results/issue-101-status-onboarding-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Simulation starten" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  const dashboard = page.locator(".desktop-dashboard");
  const overviewStatus = page.locator(".dashboard-result-status");
  await expect(overviewStatus).toContainText("Rechtsstand 2026");
  await expect(overviewStatus).toContainText("Beispielwert");
  await expect(page.getByTestId("debt-stock-kpi")).toContainText("Schuldenstand · Beispiel");

  const regions = dashboard.getByRole("button", { name: "Regionen · noch nicht berechnet" });
  await expect(regions).toBeVisible();
  await regions.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(regions).toBeFocused();
  await expect(regions).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(dashboard.locator(".region-unavailable")).toContainText("Noch nicht berechnet");
  await expect(dashboard.locator(".germany-map")).toHaveCount(0);
  await page.screenshot({ path: "test-results/issue-101-status-regions-desktop.png", fullPage: true });
  await dashboard.getByRole("button", { name: "Quelle für Regionale Wirkung" }).focus();
  await page.keyboard.press("Enter");
  const regionalEvidence = page.getByRole("dialog", { name: "Nachweis: Regionale Szenariowirkung" });
  await expect(regionalEvidence).toContainText("Noch nicht berechnet");
  await expect(regionalEvidence.locator("footer")).toContainText("Datenstand nicht belegt · Rechtsstand nicht anwendbar");
  await expect(regionalEvidence.locator(".source-list")).toContainText("Keine Primärquelle hinterlegt");
  await regionalEvidence.getByRole("button", { name: "Schließen", exact: true }).click();

  await dashboard.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("30");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(overviewStatus).toContainText("Rechtsstand 2026");
  await page.reload();
  await expect(overviewStatus).toContainText("Rechtsstand 2026");
  await expect(dashboard.getByRole("button", { name: "Regionen · noch nicht berechnet" })).toBeVisible();

  await dashboard.getByRole("button", { name: "Vergleich öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Szenariovergleich" })).toBeVisible();
  await expect(page.locator(".comparison-status-note")).toContainText("Modellannahmen");
  await expect(page.locator(".comparison-status-note")).toContainText("Gini, Armutsrisiko und regionale Wirkungen sind noch nicht berechnet");
  await expect(page.getByTestId("comparison-gini")).toContainText("noch nicht berechnet");
  await expect(page.getByTestId("comparison-poverty")).toContainText("noch nicht berechnet");
  await page.screenshot({ path: "test-results/issue-101-status-comparison-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Langfristansicht öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Baseline und Szenario im Zieljahr" })).toBeVisible();
  await expect(page.locator(".status-chip")).toHaveText("Modellschätzung · keine Prognose");
  await expect(page.locator(".long-term-status-note")).toContainText("keine amtliche Prognose");
  await expect(page.locator(".status-chip")).not.toContainText("Datenjahr 2026");
  await page.screenshot({ path: "test-results/issue-101-status-long-term-desktop.png", fullPage: true });
});

test("hält die Statuseinordnung auf mobilen Ansichten sichtbar und bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.locator(".result-status-guide")).toContainText("Noch nicht berechnet");
  await page.screenshot({ path: "test-results/issue-101-status-onboarding-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Simulation starten" }).click();

  const dashboard = page.locator(".mobile-dashboard");
  await expect(page.locator(".dashboard-result-status")).toBeVisible();
  const regions = dashboard.getByRole("button", { name: "Regionen · noch nicht berechnet" });
  await expect(regions).toBeVisible();
  await regions.focus();
  await page.keyboard.press("Enter");
  await expect(dashboard.locator(".region-unavailable")).toContainText("keine regionalen Werte");
  await expect(dashboard.locator(".germany-map")).toHaveCount(0);
  await page.screenshot({ path: "test-results/issue-101-status-regions-mobile.png", fullPage: true });

  const menu = page.getByRole("button", { name: "Hauptmenü öffnen" });
  await menu.click();
  const navigation = page.getByRole("dialog", { name: "Hauptmenü" });
  await navigation.getByRole("button", { name: "Vergleich", exact: true }).click();
  await expect(page.locator(".comparison-status-note")).toBeVisible();
  await page.screenshot({ path: "test-results/issue-101-status-comparison-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Langfristansicht öffnen" }).click();
  await expect(page.locator(".long-term-status-note")).toBeVisible();
  await expect(page.locator(".status-chip")).toContainText("keine Prognose");
  await page.screenshot({ path: "test-results/issue-101-status-long-term-mobile.png", fullPage: true });

  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
});
