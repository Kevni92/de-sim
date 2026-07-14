import { expect, test, type Locator } from "@playwright/test";

async function openSourceDrawer(button: Locator, dialog: Locator) {
  await expect(button).toBeVisible();
  await button.click();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
}

async function generateReferencePopulation(page: import("@playwright/test").Page) {
  await page.goto("./#/bevoelkerung");
  const personMetric = page.getByText("Synthetische Personen", { exact: true }).locator("..");
  await expect(personMetric.locator("strong")).not.toHaveText("–", { timeout: 60_000 });
  const sampleSize = page.getByLabel("Stichprobengröße");
  const generate = page.getByRole("button", { name: "Neu erzeugen" });
  await expect(generate).toBeEnabled();
  await sampleSize.selectOption("2000");
  await expect(sampleSize).toHaveValue("2000");
  await generate.click();
  await expect(generate).toBeEnabled({ timeout: 60_000 });
  await expect(personMetric.locator("strong")).toHaveText("2.000", { timeout: 15_000 });
}

test("öffnet Bürgergeld aus dem Dashboard und validiert den Referenzlauf", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  test.setTimeout(180_000);

  await generateReferencePopulation(page);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Bürgergeld bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/ausgaben$/);
  await expect(page.getByRole("heading", { name: "Ausgaben und Leistungen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bürgergeld und Unterkunft" })).toBeVisible();
  await expect(page.getByTestId("sgb2-editor")).toBeVisible();

  const reproducibilityKey = page.getByTestId("sgb2-reproducibility-key");
  await expect(reproducibilityKey).toHaveText(/^sgb2-[0-9a-f]{8}$/, { timeout: 60_000 });
  const baselineKey = await reproducibilityKey.textContent();
  await expect(page.getByRole("heading", { name: "Reproduzierbarkeit und amtlicher Abgleich" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amtlicher Abgleich", exact: true })).toBeVisible();
  await expect(page.getByText("Regelbedarf und Mehrbedarfe", { exact: true })).toBeVisible();
  await expect(page.getByText("Bundesanteil Unterkunft und Heizung", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quelle und Abgrenzung" })).toHaveCount(2);

  await page.getByLabel("Regelbedarfe Prozent der Baseline").fill("105");
  await page.getByRole("button", { name: "Experte" }).click();
  await expect(page.getByLabel("Alleinstehende Erwachsene Wert")).toHaveValue("591.15");
  await expect(page.getByText("Betroffene BG")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Leistungsbestandteile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nettofinanzierung" })).toBeVisible();
  await expect(reproducibilityKey).toHaveText(baselineKey ?? "");
  await page.screenshot({ path: "test-results/sgb2-expense-ui.png", fullPage: true });
});

test("Einfach- und Expertenmodus verwenden denselben kanonischen Parametersatz", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  await page.getByRole("button", { name: "Experte" }).click();
  await page.getByLabel("Alleinstehende Erwachsene Wert").fill("600");
  await page.getByRole("button", { name: "Einfach" }).click();
  await expect(page.getByText("gemischte Einzelwerte").first()).toBeVisible();
  await page.getByRole("button", { name: "Experte" }).click();
  await expect(page.getByLabel("Alleinstehende Erwachsene Wert")).toHaveValue("600");
});

test("zeigt Quelle, Rechtsstand und Unsicherheit direkt am Bürgergeldfeld", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  await page.getByRole("button", { name: "Experte" }).click();
  const field = page.locator('[data-parameter-id="sgb2.standard-need.single"]');
  await field.getByText("Quelle und Unsicherheit").click();
  await expect(field.getByText("source-sgb2-rule-rates-2026")).toBeVisible();
  await expect(field.getByText("2026-07-01")).toBeVisible();
  await expect(field.getByText("niedrig")).toBeVisible();
});

test("hält Migration und Asyl in getrennten Teilaggregaten", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  await page.locator(".expense-module-list").getByRole("button", { name: /Migration und Asyl/ }).click();
  await expect(page.getByRole("heading", { name: "Migration und Asyl" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Getrennte Teilaggregate" })).toBeVisible();
  await page.getByLabel("Integration Wert").fill("150");
  await expect(page.getByTestId("expense-module-value")).toHaveText("31,6 Mrd. €");
  await expect(page.getByText("Unterbringung").first()).toBeVisible();
  await expect(page.getByText("Verfahren und Verwaltung").first()).toBeVisible();
});

test("lädt Ausgabennachweise aus dem lokalen Worker", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  const dialog = page.getByRole("dialog", { name: "Nachweis: Ausgaben für Bürgergeld und Unterkunft" });
  await openSourceDrawer(page.getByRole("button", { name: "Berechnung und Quellen" }), dialog);
  await expect(dialog.getByRole("heading", { name: "Verwendete Parameter" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
  await expect(dialog.getByText("Regelbedarfe im Bürgergeld und in der Sozialhilfe 2026")).toBeVisible();
});

test("sichert konkrete Bürgergeldparameter per Worker und IndexedDB", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  await page.getByRole("button", { name: "Experte" }).click();
  const standardNeed = page.getByLabel("Alleinstehende Erwachsene Wert");
  await standardNeed.fill("600");
  await expect(standardNeed).toHaveValue("600");
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole("button", { name: "Experte" }).click();
  await expect(page.getByLabel("Alleinstehende Erwachsene Wert")).toHaveValue("600");
});

test("stellt Bürgergeld-Release-Abnahme auf Mobilgeräten responsiv dar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobiler Nutzerfluss");
  test.setTimeout(180_000);
  await generateReferencePopulation(page);
  await page.goto("./#/ausgaben");
  await expect(page.getByTestId("sgb2-editor")).toBeVisible();
  await expect(page.getByLabel("Regelbedarfe Prozent der Baseline")).toBeVisible();
  await expect(page.getByTestId("sgb2-reproducibility-key")).toHaveText(/^sgb2-[0-9a-f]{8}$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Reproduzierbarkeit und amtlicher Abgleich" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amtlicher Abgleich", exact: true })).toBeVisible();
});

test("öffnet Ausgabenmodule in der mobilen Dashboard-Navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobiler Nutzerfluss");
  await page.goto("./#/dashboard");
  const tabs = page.getByRole("tablist", { name: "Dashboardbereiche" });
  await tabs.getByRole("tab", { name: "Ausgaben" }).click();
  await expect(page.getByRole("heading", { name: "Ausgaben" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Rente bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/ausgaben$/);
  await expect(page.getByRole("heading", { name: "Ausgaben und Leistungen" })).toBeVisible();
  await expect(page.getByLabel("Rentenwert Wert")).toBeVisible();
});
