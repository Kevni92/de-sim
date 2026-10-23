import { expect, test, type Page } from "@playwright/test";

test.setTimeout(210_000);

async function goToDashboard(page: Page) {
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
}

test("vergleicht eigene gespeicherte Varianten mit ihren Einnahmen, Ausgaben und Grundlagen", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByLabel("Szenarioname").fill("Alternative A");
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  const standardRate = page.getByLabel("Regelsteuersatz Wert");
  await standardRate.fill("22");
  await standardRate.press("Enter");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await page.getByLabel("Grundfreibetrag Wert").fill("15000");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Rente bearbeiten" }).click();
  await page.getByLabel("Rentenwert Wert").fill("105");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");

  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const scenarioPanel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await scenarioPanel.getByRole("button", { name: "Neues Szenario", exact: true }).click();
  await scenarioPanel.getByLabel("Szenarioname im Dialog").fill("Alternative B");
  await scenarioPanel.getByLabel("Zeithorizont").selectOption("10");
  await scenarioPanel.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await standardRate.fill("25");
  await standardRate.press("Enter");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await page.getByLabel("Grundfreibetrag Wert").fill("18000");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Rente bearbeiten" }).click();
  await page.getByLabel("Rentenwert Wert").fill("115");
  await goToDashboard(page);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");

  await page.getByRole("button", { name: "Vergleich", exact: true }).click();
  const selector = page.getByLabel("Gespeicherte Alternative auswählen");
  await expect(selector.locator("option")).toHaveCount(3);
  await selector.selectOption({ label: "Alternative A" });

  const foundationWarning = page.getByTestId("comparison-foundation-warning");
  await expect(foundationWarning).toContainText("Zeithorizont");
  await expect(page.getByTestId("comparison-balance-difference")).toContainText("Nicht direkt vergleichbar");
  const incomeTaxRow = page.getByTestId("comparison-income-tax");
  await expect(incomeTaxRow.getByTestId("scenario-current-value")).not.toHaveText(await incomeTaxRow.getByTestId("scenario-alternative-value").innerText());
  const draftTaxValue = await incomeTaxRow.getByTestId("scenario-current-value").innerText();
  const expenseRow = page.getByTestId("comparison-expense");
  await expect(expenseRow.getByTestId("scenario-current-value")).not.toHaveText(await expenseRow.getByTestId("scenario-alternative-value").innerText());
  await expect(page.getByTestId("comparison-parameter-incomeTax.allowance")).toContainText("18.000 € / Jahr");
  await expect(page.getByTestId("comparison-parameter-incomeTax.allowance")).toContainText("15.000 € / Jahr");
  await expect(page.getByTestId("effect-level-comparison")).toContainText("Nicht aktuell");
  await expect(page.getByLabel("Szenarioname")).toHaveValue("Alternative B");
  await page.screenshot({ path: "test-results/issue-105-saved-comparison-desktop.png", fullPage: true });

  await selector.selectOption({ label: "Alternative B" });
  await expect(incomeTaxRow.getByTestId("scenario-current-value")).toHaveText(draftTaxValue);
  await expect(page.getByTestId("comparison-foundation-warning")).toHaveCount(0);
  await expect(page.getByTestId("comparison-balance-difference").getByText("±0,0 Mrd. €")).toBeVisible();
  await page.getByLabel("Nur Unterschiede anzeigen").check();
  await expect(page.locator(".comparison-no-changes")).toContainText("dieselben Werte");
  await page.getByLabel("Nur Unterschiede anzeigen").uncheck();

  await page.getByRole("button", { name: "Nachweis", exact: true }).click();
  const evidence = page.getByRole("dialog", { name: /Nachweis:/ });
  await expect(evidence).toBeVisible();
  await evidence.getByRole("button", { name: "Schließen", exact: true }).click();

  await selector.selectOption({ label: "Alternative A" });
  await selector.focus();
  await expect(selector).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(selector.locator("option:checked")).toHaveText("Alternative B");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/issue-105-saved-comparison-mobile.png", fullPage: true });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
});
