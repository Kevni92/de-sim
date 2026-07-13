import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

async function openPopulation(page: Page) {
  await page.goto("./#/bevoelkerung");
  await expect(page.getByRole("heading", { name: "Bevölkerung", exact: true })).toBeVisible();
  await expect(page.getByText("Aktiver Lauf")).toBeVisible();
  await expect(page.locator(".population-active-card header p")).not.toHaveText("wird geladen", { timeout: 45_000 });
  await expect(page.locator(".population-generate")).toBeEnabled({ timeout: 45_000 });
}

async function waitForGeneration(page: Page) {
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".population-generate")).toBeEnabled({ timeout: 45_000 });
}

async function selectDistribution(page: Page, name: string) {
  const tab = page.getByRole("tab", { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

test("zeigt Standardlauf, SGB-II-Summen, Verteilungen und Kalibrierung", async ({ page }) => {
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

  await page.screenshot({ path: "test-results/sgb2-population-calibration.png", fullPage: true });
});

test("anderer Seed erzeugt einen neuen Lauf, bleibt kalibriert und lässt sich löschen", async ({ page, isMobile }) => {
  test.skip(isMobile, "Laufverwaltung wird im Desktop-Funktionspfad geprüft; mobile Bedienung separat.");
  await openPopulation(page);
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.getByLabel("Seed der Bevölkerung").fill("seed-a");
  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  const firstRun = await page.locator(".population-active-card header p").innerText();

  await page.getByLabel("Seed der Bevölkerung").fill("seed-b");
  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  const secondRun = await page.locator(".population-active-card header p").innerText();
  expect(secondRun).not.toBe(firstRun);
  await expect(page.locator(".population-run-list article")).toHaveCount(3);
  await expect(page.locator(".population-calibration tbody tr").filter({ hasText: "SGB II · Bedarfsgemeinschaften" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bevölkerungslauf seed-a löschen" }).click();
  await expect(page.locator(".population-run-list article")).toHaveCount(2);
});

test("stellt Bevölkerung und SGB-II-Aggregate aus IndexedDB wieder her und nutzt den Lauf in der Einkommensteuer", async ({ page, isMobile }) => {
  test.skip(isMobile, "Persistenz und Steuerintegration werden im Desktop-Funktionspfad geprüft; mobile Bedienung separat.");
  await openPopulation(page);
  await page.getByLabel("Seed der Bevölkerung").fill("steuerlauf-7");
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.locator(".population-generate").click();
  await waitForGeneration(page);
  const runId = await page.locator(".population-active-card header p").innerText();
  const sgb2Summary = await page.locator(".population-kpi-grid").innerText();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeHidden({ timeout: 10_000 });

  await page.reload();
  await expect(page.locator(".population-active-card header p")).toHaveText(runId, { timeout: 45_000 });
  await expect.poll(() => page.locator(".population-kpi-grid").innerText()).toBe(sgb2Summary);

  await page.goto("./#/einkommensteuer");
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByText(runId)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("2.000 synthetische Personen", { exact: false })).toBeVisible();
  const scenarioValue = page.getByText("Szenariowert", { exact: true }).locator("..").locator("..").locator(":scope > strong");
  const before = await scenarioValue.innerText();
  await page.getByLabel("Grundfreibetrag Wert").fill("16000");
  await expect(page.getByLabel("Grundfreibetrag Wert")).toHaveValue("16000");
  await expect.poll(() => scenarioValue.innerText(), { timeout: 15_000 }).not.toBe(before);
});

test("exportiert die Laufreferenz und meldet eine fehlende importierte Referenz", async ({ page, isMobile }) => {
  test.skip(isMobile, "Export und Import werden im Desktop-Funktionspfad geprüft; mobile Bedienung separat.");
  await openPopulation(page);
  const runId = await page.locator(".population-active-card header p").innerText();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(dialog).toBeVisible();

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
      sgb2: { policyVersionId: string; populationRunId: string | null; modelVersion: string };
    };
  };
  expect(exported.schemaVersion).toBe(4);
  expect(exported.scenario.populationRunId).toBe(runId);
  expect(exported.scenario.populationModelVersion).toBe("synthetic-population-0.7.0");
  expect(exported.scenario.sgb2.policyVersionId).toBe("sgb2-policy-2026-07");
  expect(exported.scenario.sgb2.populationRunId).toBe(runId);
  expect(exported.scenario.sgb2.modelVersion).toBe("sgb2-0.1.0");

  const missingReference = {
    ...exported,
    scenario: { ...exported.scenario, populationRunId: "population-fehlt-lokal" },
  };
  await dialog.getByLabel("Szenario-JSON auswählen").setInputFiles({
    name: "fehlende-bevoelkerung.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(missingReference)),
  });
  await expect(page).toHaveURL(/#\/bevoelkerung$/);
  await expect(page.getByRole("alert")).toContainText("lokal nicht vorhanden");
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
  if (isMobile) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
