import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openSourceDrawer(button: Locator, dialog: Locator) {
  await expect(button).toBeVisible();
  await expect.poll(async () => {
    if (await dialog.isVisible()) return true;
    await button.click();
    return dialog.isVisible();
  }, { timeout: 10_000, intervals: [200, 400, 800] }).toBe(true);
}

test("führt vom Onboarding in das vollständige Desktop-Dashboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Ein neutraler Blick auf den deutschen Staatshaushalt." })).toBeVisible();
  await expect(page.getByText("Onboarding · Schritt 1 von 3")).toHaveCount(0);
  await expect(page.getByText("Rechtsstand 2024")).toHaveCount(0);
  await expect(page.getByText("Rechtsstand 2025")).toHaveCount(0);
  await expect(page.getByRole("note", { name: "Verwendete gesetzliche Grundlage" })).toContainText("Rechtsstand 2026");
  await page.screenshot({ path: "test-results/issue-96-start-desktop.png", fullPage: true });
  const start = page.getByRole("button", { name: "Simulation starten" });
  for (let attempt = 0; attempt < 30 && !(await start.evaluate((element) => element === document.activeElement)); attempt += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(start).toBeFocused();
  await expect(start).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ausgaben" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budgetsaldo und Änderungen" }).first()).toBeVisible();
  await expect(page.locator(".brand-copy small")).toContainText("Rechtsstand 2026");
  await page.reload();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Budgetsaldo und Änderungen" }).first()).toBeVisible();
});

test("zeigt die unterstützte Grundlage auch auf kleinen Displays", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.getByRole("note", { name: "Verwendete gesetzliche Grundlage" })).toContainText("Rechtsstand 2026");
  await expect(page.getByRole("button", { name: "Simulation starten" })).toBeVisible();
  await page.screenshot({ path: "test-results/issue-96-start-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Simulation starten" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Budgetsaldo und Änderungen" }).first()).toBeVisible();
});

test("öffnet die Einkommensteuer-Detailansicht und reagiert live", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByRole("heading", { name: "Einkommensteuer", exact: true })).toBeVisible();
  await expect(page.getByText("Gesetzliche Baseline 2026")).toBeVisible();
  const allowance = page.getByLabel("Grundfreibetrag Wert");
  await allowance.fill("15000");
  await expect(allowance).toHaveValue("15000");
  await expect(page.getByRole("heading", { name: "Tarifkurve" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Referenzhaushalte" })).toBeVisible();
});

test("berechnet den gesetzlichen Tarif 2026 und hält die Baseline unverändert", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/einkommensteuer");

  const taxCheckIncome = page.getByLabel("Zu versteuerndes Einkommen für Tarifprüfung");
  await taxCheckIncome.fill("30000");
  await expect(page.getByTestId("baseline-tax-check")).toHaveText("4.217 €");

  const allowance = page.getByLabel("Grundfreibetrag Wert");
  await allowance.fill("15000");
  await expect(page.getByTestId("baseline-tax-check")).toHaveText("4.217 €");
  await expect(page.getByText("Statische Wirkung")).toBeVisible();
  await expect(page.getByText("Verhaltensanpassung")).toBeVisible();
});

test("bildet beim gesetzlichen Tarif die Zusammenveranlagung ab", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/einkommensteuer");
  await page.getByLabel("Zu versteuerndes Einkommen für Tarifprüfung").fill("60000");
  await page.getByLabel("Veranlagung für Tarifprüfung").selectOption("joint");
  await expect(page.getByTestId("baseline-tax-check")).toHaveText("8.434 €");
});

test("öffnet die Umsatzsteuer aus dem Dashboard und berechnet eine Satzänderung live", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einnahmen$/);
  await expect(page.getByRole("heading", { name: "Steuern und Sozialbeiträge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Umsatzsteuer" })).toBeVisible();

  await page.getByLabel("Regelsteuersatz Wert").fill("20");
  await expect(page.getByTestId("revenue-module-value")).toHaveText("+13,1 Mrd. €");
  await expect(page.getByText("Direkte staatliche Wirkung").first()).toBeVisible();
  await page.getByText("Mögliche Folgewirkungen", { exact: true }).click();
  await expect(page.getByText("Modellierte Folgewirkung", { exact: true })).toBeVisible();

  await page.screenshot({ path: "test-results/milestone-5-revenue-modules.png", fullPage: true });
});

test("aktiviert ein Vermögensteuer-Szenario aus einer Null-Baseline", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/einnahmen");
  const moduleList = page.locator(".revenue-module-list");
  await moduleList.getByRole("button", { name: /Vermögensteuer/ }).click();
  await expect(page.getByRole("heading", { name: "Vermögensteuer" })).toBeVisible();
  const kpiGrid = page.getByTestId("reform-kpi-grid");
  await expect(kpiGrid.getByText("Derzeit keine Erhebung", { exact: false })).toBeVisible();

  await page.getByLabel("Steuersatz Wert").fill("1");
  await expect(page.getByTestId("revenue-module-value")).toHaveText("+11,0 Mrd. €");
  await expect(kpiGrid.getByText("Topvermögen", { exact: true })).toBeVisible();
});

test("lädt für weitere Einnahmen den vollständigen Nachweis aus dem lokalen Worker", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/einnahmen");
  const dialog = page.getByRole("dialog", { name: "Nachweis: Aufkommen der Umsatzsteuer" });
  await openSourceDrawer(page.getByRole("button", { name: "Berechnung und Quellen" }), dialog);
  await expect(dialog.getByRole("heading", { name: "Aufkommen der Umsatzsteuer" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Verwendete Parameter" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await expect(dialog.getByText("Umsatzsteuer: Steuersätze nach § 12 UStG")).toBeVisible();
});

test("sichert Parameter eines Einnahmemoduls per Autosave und IndexedDB", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/einnahmen");
  await page.getByText("Erweiterte Parameter", { exact: true }).click();
  const reducedRate = page.getByLabel("Ermäßigter Steuersatz Wert");
  await reducedRate.fill("8");
  await expect(reducedRate).toHaveValue("8");
  await page.waitForTimeout(450);
  await page.reload();
  await page.getByText("Erweiterte Parameter", { exact: true }).click();
  await expect(page.getByLabel("Ermäßigter Steuersatz Wert")).toHaveValue("8");
});

test("verwaltet einen zentralen Entwurf mit Undo, Redo und Autosave", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  const description = `Persistenter Entwurf ${Date.now()}`;

  await page.goto("./#/einkommensteuer");
  const allowance = page.getByLabel("Grundfreibetrag Wert");
  await allowance.fill("15000");
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(allowance).toHaveValue("13500");
  await page.getByRole("button", { name: "Wiederholen" }).click();
  await expect(allowance).toHaveValue("15000");

  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await dialog.getByLabel("Szenariobeschreibung").fill(description);
  await dialog.getByLabel("Zeithorizont").selectOption("10");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByLabel("Grundfreibetrag Wert")).toHaveValue("15000");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const reloadedDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(reloadedDialog.getByLabel("Szenariobeschreibung")).toHaveValue(description);
  await expect(reloadedDialog.getByLabel("Zeithorizont")).toHaveValue("10");
});

test("exportiert, importiert und dupliziert Szenarien mit abweichenden Jahresmetadaten", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);

  await dialog.getByLabel("Szenario-JSON auswählen").setInputFiles({
    name: "import-szenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      scenario: {
        name: "Importiertes Szenario",
        legalYear: 2030,
        dataYear: 2024,
        horizonYears: 20,
        incomeTax: { allowance: 16000 },
        revenueChanges: { "param.ust.standardRate": 21 },
      },
    })),
  });
  await expect(dialog.getByLabel("Szenarioname im Dialog")).toHaveValue("Importiertes Szenario");
  await expect(dialog.getByLabel("Zeithorizont")).toHaveValue("20");
  const yearContext = dialog.getByTestId("scenario-year-context");
  await expect(yearContext).toContainText("Rechtsstand 2026");
  await expect(yearContext).toContainText("Importierter Rechtsstand: 2030 · Zeitbezug der Wirkungsrechnung: 2024");
  await expect(dialog.getByLabel("Rechtsstand")).toHaveCount(0);
  await expect(dialog.getByLabel("Datenstand")).toHaveCount(0);
  await expect(page.locator(".brand-copy small")).toContainText("Rechtsstand 2026");
  await expect(page.locator(".brand-copy small")).not.toContainText("2030");
  await yearContext.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/issue-96-legacy-import-desktop.png", fullPage: true });

  const importedExportPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "JSON exportieren" }).click();
  const importedExport = await importedExportPromise;
  const importedExportPath = await importedExport.path();
  expect(importedExportPath).not.toBeNull();
  const importedPayload = JSON.parse(await readFile(importedExportPath!, "utf8")) as { scenario: { legalYear: number; dataYear: number } };
  expect(importedPayload.scenario).toMatchObject({ legalYear: 2030, dataYear: 2024 });

  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const reloadedDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(reloadedDialog.getByTestId("scenario-year-context")).toContainText("Importierter Rechtsstand: 2030 · Zeitbezug der Wirkungsrechnung: 2024");

  await reloadedDialog.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByRole("status")).toContainText("dupliziert");
  await expect(reloadedDialog.getByLabel("Szenarioname im Dialog")).toHaveValue("Importiertes Szenario (Kopie)");
});

test("ordnet importierte Jahresmetadaten im mobilen Szenariodialog ein", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  await expect(page.getByText("Rechtsstand 2026 · Quellenjahre je Kennzahl · Modellrechnung")).toBeVisible();
  await page.getByRole("button", { name: "Szenario verwalten" }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await dialog.getByLabel("Szenario-JSON auswählen").setInputFiles({
    name: "altes-szenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      scenario: { name: "Altes Mobil-Szenario", legalYear: 2030, dataYear: 2024 },
    })),
  });
  const warning = dialog.getByTestId("scenario-year-context");
  await expect(warning).toContainText("Rechtsstand 2026");
  await expect(warning).toContainText("Importierter Rechtsstand: 2030 · Zeitbezug der Wirkungsrechnung: 2024");
  await warning.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/issue-96-legacy-import-mobile.png", fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("öffnet für Dashboard-Kennzahlen den vollständigen Nachweis", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  const dialog = page.getByRole("dialog");
  await openSourceDrawer(page.getByRole("button", { name: "Quelle" }).first(), dialog);
  await expect(dialog.getByText("Nachweis und Rechenweg")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Gesamteinnahmen" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Berechnung" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Bekannte Grenzen" })).toBeVisible();
});

test("durchsucht das Transparenzregister auch nach weiteren Einnahmen", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/transparenz");
  await expect(page.getByRole("heading", { name: "Transparenzregister" })).toBeVisible();
  await expect(page.getByText("Keine Zahl ohne Status")).toBeVisible();

  await page.getByLabel("Nachweise durchsuchen").fill("Körperschaftsteuer");
  const metricCard = page.locator(".metric-card").filter({ hasText: "Aufkommen der Körperschaftsteuer" });
  await expect(metricCard).toBeVisible();
  await metricCard.getByRole("button", { name: "Nachweis öffnen" }).click();

  const dialog = page.getByRole("dialog", { name: "Nachweis: Aufkommen der Körperschaftsteuer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Unsicherheit" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Änderungsverlauf" })).toBeVisible();
});

test("erschließt Modellbasis und Wirkungsregister über Nachweise, ohne sie als Hauptnav-Punkte zu führen", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  testInfo.setTimeout(150_000);
  await page.goto("./#/dashboard");
  const mainNav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(mainNav.getByRole("button", { name: "Übersicht", exact: true })).toBeVisible();
  await expect(mainNav.getByRole("button", { name: "Einnahmen", exact: true })).toBeVisible();
  await expect(mainNav.getByRole("button", { name: "Ausgaben und Leistungen", exact: true })).toBeVisible();
  await expect(mainNav.getByRole("button", { name: "Vergleich", exact: true })).toBeVisible();
  await expect(mainNav.getByRole("button", { name: "Nachweise", exact: true })).toBeVisible();
  for (const removedLabel of ["Dashboard", "Bevölkerung", "Einkommensteuer", "Weitere Einnahmen", "Ausgaben", "Transparenz", "Wirkungen"]) {
    await expect(mainNav.getByRole("button", { name: removedLabel, exact: true })).toHaveCount(0);
  }

  await mainNav.getByRole("button", { name: "Nachweise", exact: true }).click();
  await expect(page).toHaveURL(/#\/transparenz$/);
  await expect(page.getByRole("heading", { name: "Transparenzregister" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Modellbasis und erweiterte Prüfung" })).toBeVisible();

  await page.getByRole("button", { name: /Bevölkerungslauf und Modellbasis/ }).click();
  await expect(page).toHaveURL(/#\/bevoelkerung$/);
  await expect(page.getByRole("heading", { name: "Modellbasis und Bevölkerung" })).toBeVisible({ timeout: 45_000 });
  await expect(mainNav.getByRole("button", { name: "Nachweise", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("./#/transparenz");
  await page.getByRole("button", { name: /Wirkungsregister/ }).click();
  await expect(page).toHaveURL(/#\/wirkungen$/);
  await expect(page.getByRole("heading", { name: "Indirekte und langfristige Wirkungen" })).toBeVisible({ timeout: 90_000 });
});

test("speichert und lädt ein Szenario über Worker und IndexedDB", async ({ page, isMobile }) => {
  test.skip(isMobile, "Die kompakte App-Bar zeigt Speichern nur auf Desktop");
  const name = `Milestone 5 ${Date.now()}`;
  await page.goto("./#/dashboard");
  await page.getByLabel("Szenarioname").fill(name);
  await page.getByRole("button", { name: /Speichern/ }).click();
  await expect(page.getByRole("status")).toContainText("lokal gespeichert");
  await page.reload();
  const savedRow = page.locator(".saved-scenarios li").filter({ hasText: name });
  await expect(savedRow.getByRole("button").first()).toBeVisible();
});

test("öffnet den neutralen Szenariovergleich", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Vergleich öffnen" }).click();
  await expect(page).toHaveURL(/#\/vergleich$/);
  await expect(page.getByRole("heading", { name: "Szenariovergleich" })).toBeVisible();
  await expect(page.getByText("Zentrale Politikeinstellungen")).toBeVisible();
});

test("bietet mobil Dashboard, Einkommensteuer und Einnahmemodule", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobiler Nutzerfluss");
  await page.goto("./#/dashboard");
  const tablist = page.getByRole("tablist", { name: "Dashboardbereiche" });
  await expect(tablist).toBeVisible();

  await tablist.getByRole("tab", { name: "Steuern" }).click();
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einnahmen$/);
  await expect(page.getByRole("heading", { name: "Steuern und Sozialbeiträge" })).toBeVisible();
  await expect(page.getByLabel("Regelsteuersatz Wert")).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Nachweis: Aufkommen der Umsatzsteuer" });
  await openSourceDrawer(page.getByRole("button", { name: "Berechnung und Quellen" }), dialog);
});
