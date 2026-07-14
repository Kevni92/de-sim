import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

async function openPopulation(page: Page) {
  await page.goto("./#/bevoelkerung");
  await expect(page.getByRole("heading", { name: "Modellbasis und Bevölkerung", exact: true })).toBeVisible();
  await expect(page.getByText("Aktive Modellbasis")).toBeVisible();
  await expect(page.locator(".population-active-card header p")).not.toHaveText("wird geladen", { timeout: 60_000 });
  await expect(page.locator(".population-generate")).toBeEnabled({ timeout: 60_000 });
}

async function waitForGeneration(page: Page) {
  await expect(page.getByText("Synthetische Modellbasis erzeugt und aktiviert")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".population-generate")).toBeEnabled({ timeout: 60_000 });
}

async function waitForReadyBasis(page: Page) {
  const status = page.getByTestId("model-basis-status");
  await expect(status.getByText(/^bereit(?: mit Qualitätswarnung)?$/)).toBeVisible({ timeout: 60_000 });
  return status;
}

async function selectDistribution(page: Page, name: string) {
  const tab = page.getByRole("tab", { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

test("stellt die Standard-Modellbasis für Einkommensteuer und Bürgergeld ohne manuellen Schritt bereit", async ({ page, isMobile }) => {
  await page.goto("./#/einkommensteuer");
  const status = await waitForReadyBasis(page);
  await expect(status).toContainText(/reproduzierbare, versionierte Datenbasis|Berechnung ist verfügbar/);
  await expect(page.locator("body")).not.toContainText("population-");
  await expect(page.getByLabel("Grundfreibetrag Wert")).toBeVisible();
  await page.getByLabel("Grundfreibetrag Wert").fill("15000");
  await expect(page.getByRole("heading", { name: "Verteilungswirkung" })).toBeVisible();

  await page.goto("./#/ausgaben");
  await waitForReadyBasis(page);
  await expect(page.getByRole("heading", { name: "Bürgergeld und Unterkunft" })).toBeVisible();
  await expect(page.getByTestId("sgb2-editor")).toBeVisible();
  if (isMobile) await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await page.screenshot({ path: `test-results/issue-35-model-basis-compact-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});

test("verwendet die vorhandene Standardbasis nach Neuladen erneut", async ({ page, isMobile }) => {
  test.skip(isMobile, "Wiederverwendung wird im Desktop-Funktionspfad geprüft.");
  await page.goto("./#/einkommensteuer");
  await waitForReadyBasis(page);
  await page.reload();
  await waitForReadyBasis(page);

  await page.getByRole("button", { name: "Modellbasis prüfen" }).click();
  await expect(page).toHaveURL(/#\/bevoelkerung$/);
  await expect(page.locator(".population-run-list article")).toHaveCount(1);
  await expect(page.locator(".population-run-list").getByText("10.000 Personen", { exact: false })).toBeVisible();
});

test("zeigt Standardlauf, SGB-II-Summen, Verteilungen und Kalibrierung in der erweiterten Prüfebene", async ({ page }) => {
  await openPopulation(page);
  await expect(page.getByText("Synthetische Personen")).toBeVisible();
  await expect(page.getByText("Gewichtete Bevölkerung")).toBeVisible();
  await expect(page.getByText("Gewichtete Bedarfsgemeinschaften")).toBeVisible();
  await expect(page.getByText("Mittlere Bezugsdauer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kalibrierungsbericht" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Ziel" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Modell" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Abweichung" })).toBeVisible();
  await selectDistribution(page, "Haushaltsformen");
  await expect(page.locator(".population-bars").getByText("Paar mit Kindern", { exact: true })).toBeVisible();
  await selectDistribution(page, "SGB-II-BG-Typen");
  await expect(page.locator(".population-bars").getByText("Alleinstehend", { exact: true })).toBeVisible();
  await selectDistribution(page, "Bezugsmonate");
  await expect(page.locator(".population-bars").getByText("10-12", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/issue-35-model-basis-management.png", fullPage: true });
});

test("erzeugt mit gleichem Seed reproduzierbare Zusammenfassungen", async ({ page, isMobile }) => {
  test.skip(isMobile, "Reproduzierbarkeit wird im Desktop-Funktionspfad geprüft; mobile Bedienung separat.");
  await openPopulation(page);
  await page.getByLabel("Seed der Bevölkerung").fill("playwright-reproduzierbar");
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  const firstRun = await page.locator(".population-active-card header p").innerText();
  const firstSummary = await page.locator(".population-kpi-grid").innerText();

  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  await expect(page.locator(".population-active-card header p")).toHaveText(firstRun);
  await expect.poll(() => page.locator(".population-kpi-grid").innerText()).toBe(firstSummary);
});

test("rekonstruiert eine gelöschte referenzierte Modellbasis mit ursprünglichen Parametern", async ({ page, isMobile }) => {
  test.skip(isMobile, "Laufverwaltung wird im Desktop-Funktionspfad geprüft.");
  await openPopulation(page);
  await page.getByLabel("Seed der Bevölkerung").fill("wiederherstellbar-35");
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  const runId = await page.locator(".population-active-card header p").innerText();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bevölkerungslauf wiederherstellbar-35 löschen" }).click();
  await expect(page.getByRole("status")).toContainText("Szenarioreferenz bleibt erhalten", { timeout: 60_000 });
  await page.goto("./#/einkommensteuer");

  const status = page.getByTestId("model-basis-status");
  await expect(status.getByText("ursprüngliche Referenz fehlt", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(status.getByRole("button", { name: "Identische Modellbasis neu erzeugen" })).toBeVisible();
  await status.getByRole("button", { name: "Identische Modellbasis neu erzeugen" }).click();
  await waitForReadyBasis(page);
  await page.getByRole("button", { name: "Modellbasis prüfen" }).click();
  await expect(page.locator(".population-active-card header p")).toHaveText(runId, { timeout: 60_000 });
});

test("ersetzt eine nicht rekonstruierbare Importreferenz nur nach bewusster Entscheidung", async ({ page, isMobile }) => {
  test.skip(isMobile, "Importentscheidung wird im Desktop-Funktionspfad geprüft.");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await dialog.getByLabel("Szenario-JSON auswählen").setInputFiles({
    name: "fehlende-alte-modellbasis.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 4,
      scenario: {
        name: "Import mit fehlender Modellbasis",
        populationRunId: "population-fehlt-lokal",
        populationModelVersion: "synthetic-population-0.7.0",
      },
    })),
  });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.evaluate(() => { window.location.hash = "/einkommensteuer"; });

  const status = page.getByTestId("model-basis-status");
  await expect(status.getByText("ursprüngliche Referenz fehlt", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(status).toContainText("Eine andere Modellbasis kann Ergebnisse verändern");
  await expect(status.getByRole("button", { name: "Identische Modellbasis neu erzeugen" })).toHaveCount(0);
  await status.getByRole("button", { name: "Standard-Modellbasis verwenden" }).click();
  await waitForReadyBasis(page);
  await expect(page.locator(".toast")).toContainText("bewusst übernommen");
});

test("exportiert Laufreferenz und Rekonstruktionsmetadaten", async ({ page, isMobile }) => {
  test.skip(isMobile, "Export wird im Desktop-Funktionspfad geprüft.");
  await page.goto("./#/einkommensteuer");
  await waitForReadyBasis(page);
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    schemaVersion: number;
    scenario: {
      populationRunId: string | null;
      populationModelVersion: string | null;
      populationBasis: { runId: string; modelVersion: string; seed: string; sampleSize: number; baselineId: string } | null;
      sgb2: { populationRunId: string | null };
    };
  };
  expect(exported.schemaVersion).toBe(6);
  expect(exported.scenario.populationBasis).not.toBeNull();
  expect(exported.scenario.populationBasis?.runId).toBe(exported.scenario.populationRunId);
  expect(exported.scenario.populationBasis?.modelVersion).toBe("synthetic-population-0.7.0");
  expect(exported.scenario.populationBasis?.seed).toBe("de-sim-2025");
  expect(exported.scenario.populationBasis?.sampleSize).toBe(10_000);
  expect(exported.scenario.populationBasis?.baselineId).toBe("de-2024-2025-v1");
  expect(exported.scenario.sgb2.populationRunId).toBe(exported.scenario.populationRunId);
});

test("öffnet Bevölkerungs- und SGB-II-Nachweise und bleibt mobil bedienbar", async ({ page, isMobile }) => {
  await openPopulation(page);
  await page.getByRole("button", { name: "Methode und Quellen" }).click();
  let dialog = page.getByRole("dialog", { name: /Nachweis:/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "SGB-II-Statistik" }).click();
  dialog = page.getByRole("dialog", { name: /Nachweis:/ });
  await expect(dialog.getByRole("heading", { name: "Statistik der Grundsicherung für Arbeitsuchende", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  if (isMobile) await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
