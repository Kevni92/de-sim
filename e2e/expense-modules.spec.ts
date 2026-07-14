import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSourceDrawer(button: Locator, dialog: Locator) {
  await expect(button).toBeVisible();
  await button.click();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
}

async function openBuergergeld(page: Page) {
  await page.goto("./#/ausgaben");
  await expect(page.getByTestId("sgb2-editor")).toBeVisible();
  await expect(page.getByTestId("sgb2-standard-result-kpis")).toBeVisible({ timeout: 120_000 });
}

async function openResultDetail(page: Page, label: string) {
  const details = page.locator("details.sgb2-result-detail").filter({ hasText: label });
  const summary = details.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  return details;
}

test.describe.configure({ timeout: 210_000 });

test("ändert Bürgergeld ohne Bevölkerungsseite in verständlicher Alltagssprache", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Bürgergeld bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/ausgaben$/);
  const editor = page.getByTestId("sgb2-editor");
  await expect(editor).toBeVisible();
  await expect(page.getByRole("heading", { name: "Politische Stellschrauben" })).toBeVisible();
  await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toBeVisible();
  await expect(page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen")).toHaveValue("100");
  await expect(page.getByLabel("Anerkennungsgrenzen für Unterkunft und Heizung verändern")).toBeVisible();

  const kpis = page.getByTestId("sgb2-standard-result-kpis");
  await expect(kpis).toBeVisible({ timeout: 120_000 });
  await expect(kpis.locator("article")).toHaveCount(4);
  await expect(kpis.getByText("Staatliche Wirkung pro Jahr", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Betroffene Menschen", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Durchschnitt pro Bezugsmonat", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Belastbarkeit", { exact: true })).toBeVisible();
  await expect(editor).not.toContainText("Betroffene BG");

  await page.getByLabel("Regelbedarfe Veränderung in Prozent").fill("5");
  await expect(page.getByTestId("sgb2-standard-needs-control")).toContainText("591,15 € pro Monat");
  await expect(kpis).toContainText(/\+|−|±/, { timeout: 120_000 });
  await expect(kpis.getByText("Hohe Unsicherheit", { exact: true })).toBeVisible();
  await expect(page.getByTestId("sgb2-housing-control")).toContainText("Außerhalb vollständig integrierter Regionen");

  const components = await openResultDetail(page, "Leistungsbestandteile und Ausgangswerte");
  await expect(components.getByText("Regelbedarf", { exact: true })).toBeVisible();
  const financing = await openResultDetail(page, "Finanzierung und Kostenträger");
  await expect(financing).toContainText("Freie Kalibriergröße");
  const validation = await openResultDetail(page, "Fachliche Prüfung und amtlicher Abgleich");
  await expect(validation.getByTestId("sgb2-reproducibility-key")).toHaveText(/^sgb2-[0-9a-f]{8}$/);
  await expect(validation.getByRole("heading", { name: "Amtlicher Abgleich", exact: true })).toBeVisible();

  await page.screenshot({ path: "test-results/issue-38-buergergeld-standard-desktop.png", fullPage: true });
});

test("Standard- und Expertenmodus erhalten denselben kanonischen Parametersatz", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await openBuergergeld(page);
  await page.getByRole("button", { name: "Experte" }).click();
  await page.getByLabel("Alleinstehende Erwachsene Wert").fill("600");
  await page.getByRole("button", { name: "Standard" }).click();
  await expect(page.getByText("Einzelwerte im Expertenmodus geändert").first()).toBeVisible();
  await page.getByRole("button", { name: "Experte" }).click();
  await expect(page.getByLabel("Alleinstehende Erwachsene Wert")).toHaveValue("600");
  await page.screenshot({ path: "test-results/issue-38-buergergeld-experte-desktop.png", fullPage: true });
});

test("zeigt Quelle, Rechtsstand und Unsicherheit direkt am Bürgergeldfeld", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await openBuergergeld(page);
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
});

test("lädt Ausgabennachweise aus dem lokalen Worker", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await openBuergergeld(page);
  const dialog = page.getByRole("dialog", { name: "Nachweis: Ausgaben für Bürgergeld und Unterkunft" });
  await openSourceDrawer(page.getByRole("button", { name: "Berechnung und Quellen", exact: true }).first(), dialog);
  await expect(dialog.getByRole("heading", { name: "Verwendete Parameter" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
});

test("persistiert Standardentscheidungen und setzt vollständig auf Baseline zurück", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await openBuergergeld(page);
  await page.getByLabel("Regelbedarfe Veränderung in Prozent").fill("7");
  await page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen").fill("150");
  await page.getByLabel("Anerkennungsgrenzen für Unterkunft und Heizung verändern").fill("12");
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toHaveValue("7");
  await expect(page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen")).toHaveValue("150");
  await expect(page.getByLabel("Anerkennungsgrenzen für Unterkunft und Heizung verändern")).toHaveValue("12");
  await page.getByRole("button", { name: "Alle Änderungen zurücksetzen" }).click();
  await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toHaveValue("0");
  await expect(page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen")).toHaveValue("100");
  await expect(page.getByLabel("Anerkennungsgrenzen für Unterkunft und Heizung verändern")).toHaveValue("0");
});

test("stellt den Bürgergeld-Standardmodus mobil responsiv und per Tastatur bereit", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobiler Nutzerfluss");
  await openBuergergeld(page);
  await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toBeVisible();
  await expect(page.getByTestId("sgb2-standard-result-kpis").locator("article")).toHaveCount(4);
  const moreRules = page.locator("details.sgb2-more-rules");
  const summary = moreRules.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(moreRules).toHaveAttribute("open", "");
  await expect(page.getByLabel("Mehrbedarfe Veränderung in Prozent")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/issue-38-buergergeld-standard-mobile.png", fullPage: true });
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
