import { expect, test } from "@playwright/test";

test("ordnet zentrale Dashboardwerte und Referenzhaushalte ein und macht den Nachweis per Tastatur erreichbar", async ({ page, isMobile }) => {
  await page.goto("./#/dashboard");

  const context = page.getByTestId("dashboard-money-context");
  await expect(context).toContainText("Staatliche Perspektive");
  await expect(context).toContainText("Jahreswerte in Mrd. €");
  await expect(context).toContainText("Referenzdatenjahr 2025");
  await expect(context).toContainText("Preisgrundlage nicht ausgewiesen");
  const debt = page.getByTestId("debt-stock-kpi");
  await expect(debt).toContainText("Bestandswert");
  await expect(debt).toContainText("ohne belegten Stichtag");

  const householdTab = page.getByRole("button", { name: "Haushalte", exact: true });
  await householdTab.click();
  await expect(page.locator(".section-description:visible").filter({ hasText: "Private Haushaltsperspektive: direkte Monatswirkung; Steuerwerte pro Jahr." })).toBeVisible();

  const evidenceButton = page.getByRole("button", { name: "Quelle für Referenzhaushalte" });
  await evidenceButton.focus();
  await expect(evidenceButton).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Nachweis: Wirkung auf Referenzhaushalte" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Monatswirkung");
  await expect(drawer).toContainText("Illustrative Referenzhaushalte");
  await expect(drawer).toContainText("Private Haushaltsperspektive");
  await expect(drawer).toContainText("Preisgrundlage");
  await expect(drawer).toContainText("nicht ausgewiesen");
  await expect(drawer).toContainText("€ pro Monat");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  if (isMobile) {
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
    await page.screenshot({ path: "test-results/issue-108-metric-context-dashboard-mobile.png", fullPage: true });
  } else {
    await page.screenshot({ path: "test-results/issue-108-metric-context-dashboard-desktop.png", fullPage: true });
  }
});

test("ordnet die Jahreswerte im Szenariovergleich ein und hält Wirkungspfade getrennt", async ({ page, isMobile }) => {
  await page.goto("./#/vergleich");

  const context = page.getByTestId("comparison-money-context");
  await expect(context).toContainText("Staatliche Perspektive");
  await expect(context).toContainText("Jahreswerte in Mrd. €");
  await expect(context).toContainText("Referenzdatenjahr 2025");
  await expect(context).toContainText("Preisgrundlage nicht ausgewiesen");
  await expect(page.getByTestId("comparison-effects-context")).toContainText("separate Szenariowerte im gewählten Zeithorizont");

  const table = page.getByRole("region", { name: "Haushaltskennzahlen im Vergleich" });
  await expect(table).toBeVisible();
  if (isMobile) {
    await table.focus();
    await expect(table).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
    await page.screenshot({ path: "test-results/issue-108-metric-context-comparison-mobile.png", fullPage: true });
  } else {
    await page.screenshot({ path: "test-results/issue-108-metric-context-comparison-desktop.png", fullPage: true });
  }
});

test("kennzeichnet Geldwerte der Alterssicherung als Jahresströme im Zieljahr ohne ausgewiesene Preisbasis", async ({ page, isMobile }) => {
  await page.goto("./#/langfrist");
  await page.getByLabel("Zieljahr", { exact: true }).selectOption("2070");

  await expect(page.getByTestId("long-term-money-context")).toContainText("staatlicher Teilhaushalt");
  await expect(page.getByTestId("long-term-money-context")).toContainText("Jahresströme in Mrd. € im Zieljahr 2070");
  await expect(page.getByTestId("long-term-money-context")).toContainText("Preisgrundlage nicht ausgewiesen");
  const balance = page.getByTestId("long-term-row-pension-balance");
  await expect(balance).toContainText("Saldo der Alterssicherung");
  await expect(balance.getByTestId("scenario")).toContainText("Mrd. € pro Jahr");
  await expect(page.locator(".long-term-finance-list")).toContainText("Mrd. € pro Jahr");

  if (isMobile) {
    const region = page.getByRole("region", { name: "Langfristkennzahlen für 2070" });
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
    await page.screenshot({ path: "test-results/issue-108-metric-context-long-term-mobile.png", fullPage: true });
  } else {
    await page.screenshot({ path: "test-results/issue-108-metric-context-long-term-desktop.png", fullPage: true });
  }
});
