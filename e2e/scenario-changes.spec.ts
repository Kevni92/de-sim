import { expect, test } from "@playwright/test";

test("zeigt importierte Änderungen aus drei Modulen, Einzelreset und Undo/Redo konsistent", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  const importInput = panel.getByLabel("Szenario-JSON auswählen");
  const imported = {
    schemaVersion: 7,
    scenario: {
      name: "Reformpaket Test",
      description: "Drei Module mit einzelnen Änderungen.",
      legalYear: 2026,
      dataYear: 2025,
      incomeTax: { allowance: 15_000 },
      revenueChanges: { "param.ust.standardRate": 21, "param.ust.reducedShare": 35 },
      sgb2: { parameterOverrides: [
        { parameterId: "sgb2.standard-need.single", value: 60_000 },
        { parameterId: "sgb2.standard-need.partner", value: 55_000 },
      ] },
    },
  };
  await importInput.setInputFiles({ name: "reformpaket.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Reformpaket Test");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Deine Änderungen", exact: true }).click();

  const overview = page.getByTestId("scenario-changes-summary");
  await expect(overview).toContainText("politische Änderungen");
  const allowance = page.getByTestId("scenario-change-incomeTax.allowance");
  const vat = page.getByTestId("scenario-change-param.ust.standardRate");
  const single = page.getByTestId("scenario-change-sgb2.standard-need.single");
  const partner = page.getByTestId("scenario-change-sgb2.standard-need.partner");
  await expect(allowance).toContainText("12.348 € / Jahr");
  await expect(allowance).toContainText("15.000 € / Jahr");
  await expect(vat).toContainText("19 %");
  await expect(vat).toContainText("21 %");
  await expect(single).toContainText("600 € / Monat");
  await expect(partner).toContainText("550 € / Monat");
  await expect(page.getByRole("heading", { name: /Bürgergeld und Unterkunft · Regelbedarfe/ })).toBeVisible();
  await page.screenshot({ path: "test-results/scenario-changes-overview-desktop.png", fullPage: true });

  await single.getByRole("button", { name: "Alleinstehende Erwachsene auf Baseline zurücksetzen" }).click();
  await expect(page.getByTestId("scenario-change-sgb2.standard-need.single")).toHaveCount(0);
  await expect(partner).toBeVisible();
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.getByTestId("scenario-change-sgb2.standard-need.single")).toBeVisible();
  await page.getByRole("button", { name: "Wiederholen" }).click();
  await expect(page.getByTestId("scenario-change-sgb2.standard-need.single")).toHaveCount(0);

  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByTestId("scenario-change-param.ust.standardRate")).toContainText("21 %");
  await expect(page.getByTestId("scenario-change-sgb2.standard-need.single")).toHaveCount(0);
  await expect(page.getByTestId("scenario-change-sgb2.standard-need.partner")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/scenario-changes-overview-mobile.png", fullPage: true });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
});

test("öffnet von der Änderungsliste aus das passende Modul und fasst das Paket vor dem Vergleich zusammen", async ({ page }) => {
  await page.goto("./#/aenderungen");
  const rate = page.getByTestId("scenario-change-incomeTax.entryRate");
  await expect(rate).toBeVisible();
  await rate.getByRole("button", { name: "Im Modul öffnen: Eingangssteuersatz" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByRole("heading", { name: "Einkommensteuer" })).toBeVisible();

  await page.getByRole("button", { name: "Vergleich", exact: true }).click();
  await expect(page.getByTestId("comparison-change-summary")).toContainText("politische Änderungen");
  await page.getByRole("button", { name: "Deine Änderungen ansehen" }).click();
  await expect(page).toHaveURL(/#\/aenderungen$/);
});
