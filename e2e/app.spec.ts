import { expect, test } from "@playwright/test";

test("führt vom Onboarding in das vollständige Desktop-Dashboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Ein neutraler Blick auf den deutschen Staatshaushalt." })).toBeVisible();
  await page.getByRole("button", { name: "Simulation starten" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ausgaben" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wasserfall Budgetsaldo" }).first()).toBeVisible();
});

test("öffnet die Einkommensteuer-Detailansicht und reagiert live", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByRole("heading", { name: "Einkommensteuer", exact: true })).toBeVisible();
  const allowance = page.getByLabel("Grundfreibetrag Wert");
  await allowance.fill("15000");
  await expect(allowance).toHaveValue("15000");
  await expect(page.getByRole("heading", { name: "Tarifkurve" })).toBeVisible();
  await expect(page.getByText("Du hast ungefähr").first()).toBeVisible();
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
  await page.screenshot({ path: "test-results/milestone-2-scenario-panel.png", fullPage: true });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByLabel("Grundfreibetrag Wert")).toHaveValue("15000");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const reloadedDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(reloadedDialog.getByLabel("Szenariobeschreibung")).toHaveValue(description);
  await expect(reloadedDialog.getByLabel("Zeithorizont")).toHaveValue("10");
});

test("exportiert, importiert und dupliziert Szenarien", async ({ page, isMobile }) => {
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
        horizonYears: 20,
        incomeTax: { allowance: 16000 },
      },
    })),
  });
  await expect(dialog.getByLabel("Szenarioname im Dialog")).toHaveValue("Importiertes Szenario");
  await expect(dialog.getByLabel("Zeithorizont")).toHaveValue("20");

  await dialog.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByRole("status")).toContainText("dupliziert");
  await expect(dialog.getByLabel("Szenarioname im Dialog")).toHaveValue("Importiertes Szenario (Kopie)");
});

test("zeigt Quellen und Methodik in einem Drawer", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Quelle" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Quelle und Methodik")).toBeVisible();
  await expect(dialog.getByText("Institution")).toBeVisible();
  await expect(dialog.getByText("Bekannte Grenzen")).toBeVisible();
});

test("speichert und lädt ein Szenario über Worker und IndexedDB", async ({ page, isMobile }) => {
  test.skip(isMobile, "Die kompakte App-Bar zeigt Speichern nur auf Desktop");
  const name = `Milestone 2 ${Date.now()}`;
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

test("bietet mobil Tabs, Quellen, Detailseite und Szenarioverwaltung", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobiler Nutzerfluss");
  await page.goto("./#/dashboard");
  const tablist = page.getByRole("tablist", { name: "Dashboardbereiche" });
  await expect(tablist).toBeVisible();

  await tablist.getByRole("tab", { name: "Steuern" }).click();
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByRole("heading", { name: "Einkommensteuer", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Annahmen und Quellen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Szenario verwalten" })).toBeVisible();
});
