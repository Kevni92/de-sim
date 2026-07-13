import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function openPopulation(page: Page) {
  await page.goto("./#/bevoelkerung");
  await expect(page.getByRole("heading", { name: "Bevölkerung", exact: true })).toBeVisible();
  await expect(page.getByText("Aktiver Lauf")).toBeVisible();
}

test("zeigt Standardlauf, Summen, Verteilungen und Kalibrierung", async ({ page }) => {
  await openPopulation(page);
  await expect(page.getByText("Synthetische Personen")).toBeVisible();
  await expect(page.getByText("Gewichtete Bevölkerung")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kalibrierungsbericht" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Ziel" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Modell" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Abweichung" })).toBeVisible();
  await page.getByRole("tab", { name: "Haushaltsformen" }).click();
  await expect(page.getByText("Paar mit Kindern")).toBeVisible();
  await page.getByRole("tab", { name: "Wohnen" }).click();
  await expect(page.getByText("Eigentum")).toBeVisible();
});

test("erzeugt mit gleichem Seed reproduzierbare Zusammenfassungen", async ({ page, isMobile }) => {
  await openPopulation(page);
  await page.getByLabel("Seed der Bevölkerung").fill("playwright-reproduzierbar");
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.getByRole("button", { name: "Neu erzeugen" }).click();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible();
  const firstRun = await page.locator(".population-active-card header p").innerText();
  const firstSummary = await page.locator(".population-kpi-grid").innerText();

  await page.getByRole("button", { name: "Neu erzeugen" }).click();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible();
  await expect(page.locator(".population-active-card header p")).toHaveText(firstRun);
  await expect(page.locator(".population-kpi-grid")).toHaveText(firstSummary);
  await expect(page.locator(".population-calibration .population-status.warnung")).toHaveCount(0);

  if (!isMobile) await page.screenshot({ path: "test-results/milestone-7-synthetic-population.png", fullPage: true });
});

test("anderer Seed erzeugt einen neuen Lauf, bleibt kalibriert und lässt sich löschen", async ({ page }) => {
  await openPopulation(page);
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.getByLabel("Seed der Bevölkerung").fill("seed-a");
  await page.getByRole("button", { name: "Neu erzeugen" }).click();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible();
  const firstRun = await page.locator(".population-active-card header p").innerText();

  await page.getByLabel("Seed der Bevölkerung").fill("seed-b");
  await page.getByRole("button", { name: "Neu erzeugen" }).click();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible();
  const secondRun = await page.locator(".population-active-card header p").innerText();
  expect(secondRun).not.toBe(firstRun);
  await expect(page.locator(".population-run-list article")).toHaveCount(3);
  await expect(page.locator(".population-calibration .population-status.warnung")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bevölkerungslauf seed-a löschen" }).click();
  await expect(page.locator(".population-run-list article")).toHaveCount(2);
});

test("stellt den aktiven Lauf aus IndexedDB wieder her und nutzt ihn in der Einkommensteuer", async ({ page }) => {
  await openPopulation(page);
  await page.getByLabel("Seed der Bevölkerung").fill("steuerlauf-7");
  await page.getByLabel("Stichprobengröße").selectOption("2000");
  await page.getByRole("button", { name: "Neu erzeugen" }).click();
  await expect(page.getByText("Synthetische Bevölkerung erzeugt und aktiviert")).toBeVisible();
  const runId = await page.locator(".population-active-card header p").innerText();
  await page.reload();
  await expect(page.locator(".population-active-card header p")).toHaveText(runId);

  await page.getByRole("button", { name: "Einkommensteuer" }).click();
  await expect(page).toHaveURL(/#\/einkommensteuer$/);
  await expect(page.getByText(runId)).toBeVisible();
  await expect(page.getByText("2.000 synthetische Personen", { exact: false })).toBeVisible();
  const before = await page.getByText("Gewinner").locator("..").innerText();
  await page.getByLabel("Grundfreibetrag Wert").fill("16000");
  await expect(page.getByLabel("Grundfreibetrag Wert")).toHaveValue("16000");
  await expect.poll(async () => page.getByText("Gewinner").locator("..").innerText()).not.toBe(before);
});

test("exportiert die Laufreferenz und meldet eine fehlende importierte Referenz", async ({ page }) => {
  await openPopulation(page);
  const runId = await page.locator(".population-active-card header p").innerText();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Szenario verwalten" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    schemaVersion: number;
    scenario: { populationRunId: string | null; populationModelVersion: string | null };
  };
  expect(exported.schemaVersion).toBe(2);
  expect(exported.scenario.populationRunId).toBe(runId);
  expect(exported.scenario.populationModelVersion).toBe("synthetic-population-0.7.0");

  const missingReference = {
    ...exported,
    scenario: { ...exported.scenario, populationRunId: "population-fehlt-lokal" },
  };
  await page.getByLabel("Szenario-JSON auswählen").setInputFiles({
    name: "fehlende-bevoelkerung.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(missingReference)),
  });
  await expect(page).toHaveURL(/#\/bevoelkerung$/);
  await expect(page.getByRole("alert")).toContainText("lokal nicht vorhanden");
});

test("öffnet den Bevölkerungsnachweis und bleibt mobil bedienbar", async ({ page, isMobile }) => {
  await openPopulation(page);
  await page.getByRole("button", { name: "Methode und Quellen" }).click();
  await expect(page.getByRole("dialog", { name: /Nachweis:/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  if (isMobile) {
    await expect(page.getByLabel("Seed der Bevölkerung")).toBeVisible();
    await page.getByRole("tab", { name: "Einkommensdezile" }).click();
    await expect(page.getByText("Dezil 10")).toBeVisible();
  }
});

test("verursacht im zentralen Bevölkerungspfad keine Konsolen- oder Seitenfehler", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await openPopulation(page);
  await page.getByRole("tab", { name: "Einkommensdezile" }).click();
  await page.getByRole("button", { name: "Einkommensteuer" }).click();
  await expect(page.getByRole("heading", { name: "Steuern und Sozialbeiträge" })).toBeVisible();
  expect(errors).toEqual([]);
});
