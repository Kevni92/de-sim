import { expect, test, type Page } from "@playwright/test";

type ImportedScenario = Record<string, unknown> & { name: string };

async function importScenario(page: Page, isMobile: boolean, scenario: ImportedScenario) {
  await page.goto("./#/dashboard");
  if (isMobile) {
    await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
    await page.getByRole("dialog", { name: "Hauptmenü" }).getByRole("button", { name: "Szenario verwalten" }).click();
  } else {
    await page.getByRole("button", { name: "Szenario", exact: true }).click();
  }

  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await panel.getByLabel("Szenario-Datei auswählen").setInputFiles({
    name: `${scenario.name}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 7, scenario })),
  });
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue(scenario.name);
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
}

async function openHouseholdView(page: Page, isMobile: boolean, useKeyboard = false) {
  if (isMobile) await page.getByRole("tab", { name: "Ergebnis" }).click();
  const center = page.locator(isMobile ? ".mobile-dashboard .center-panel" : ".desktop-dashboard .center-panel");
  await expect(center).toBeVisible();
  const tab = center.locator(".result-tabs").getByRole("button", { name: "Haushalte", exact: true });
  if (useKeyboard) {
    await tab.focus();
    await expect(tab).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await tab.click();
  }
  await expect(tab).toHaveClass(/active/);
  return center;
}

test("kennzeichnet die Einkommensteuer als Umfang der Haushalts- und Verteilungsansicht", async ({ page, isMobile }) => {
  await importScenario(page, isMobile, { name: "Nur Einkommensteuer", incomeTax: { allowance: 15_000 } });
  const center = await openHouseholdView(page, isMobile, true);
  const scope = center.getByTestId("household-distribution-scope");
  await expect(scope).toContainText("Haushalte und Verteilung zeigen derzeit nur die Einkommensteuer");
  await expect(scope).toContainText("Geändert und in dieser Ansicht enthalten: Einkommensteuer.");
  await expect(scope).not.toContainText("Nicht abgebildet:");
  await expect(center.locator(".result-content")).toContainText("Referenzhaushalte · Einkommensteuer");
  await center.getByRole("button", { name: "Quelle für Referenzhaushalte" }).click();
  const source = page.getByRole("dialog", { name: "Nachweis: Wirkung auf Referenzhaushalte" });
  await expect(source).toBeVisible();
  await source.getByRole("button", { name: "Schließen", exact: true }).click();
  if (isMobile) {
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
  }
  await page.screenshot({ path: `test-results/issue-107-income-tax-scope-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});

test("erklärt bei einer reinen Umsatzsteueränderung die fehlende Haushaltsabdeckung", async ({ page, isMobile }) => {
  const incomeTaxBaseline = {
    allowance: 12_348,
    entryRate: 14,
    topRate: 42,
    topThreshold: 69_879,
    richRate: 45,
    childAllowance: 9_756,
    spouseSplitting: true,
  };
  await importScenario(page, isMobile, { name: "Unveränderte Einkommensteuer", incomeTax: incomeTaxBaseline });
  const baselineCenter = await openHouseholdView(page, isMobile);
  const baselineHouseholds = await baselineCenter.locator(".result-content").innerText();

  await page.getByRole("button", { name: "Umsatzsteuer bearbeiten" }).click();
  await page.getByLabel("Regelsteuersatz Wert").fill("21");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  const center = await openHouseholdView(page, isMobile);
  const scope = center.getByTestId("household-distribution-scope");
  await expect(scope).toContainText("Einkommensteuer wird angezeigt, ist in diesem Paket aber unverändert.");
  await expect(scope).toContainText("Umsatzsteuer");
  await expect(scope).toContainText("hier nicht abgebildet");
  await expect(scope).toContainText("belegen keine Wirkungslosigkeit");
  await expect(center.locator(".result-content")).toHaveText(baselineHouseholds);
  await page.screenshot({ path: `test-results/issue-107-vat-scope-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});

test("ordnet eine alleinige Leistungsänderung als nicht abgebildet ein", async ({ page, isMobile }) => {
  await importScenario(page, isMobile, {
    name: "Nur Bürgergeld",
    sgb2: { parameterOverrides: [{ parameterId: "sgb2.standard-need.single", value: 60_000 }] },
  });
  const center = await openHouseholdView(page, isMobile);
  const scope = center.getByTestId("household-distribution-scope");
  await expect(scope).toContainText("Bürgergeld und Unterkunft");
  await expect(scope).toContainText("hier nicht abgebildet");
  await expect(scope).toContainText("belegen keine Wirkungslosigkeit");
  await page.screenshot({ path: `test-results/issue-107-benefit-scope-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});

test("nennt Einkommensteuer und Umsatzsteuer getrennt in einem gemischten Reformpaket", async ({ page, isMobile }) => {
  await importScenario(page, isMobile, {
    name: "Einkommensteuer und Umsatzsteuer",
    incomeTax: { allowance: 15_000 },
    revenueChanges: { "param.ust.standardRate": 21 },
  });
  const center = await openHouseholdView(page, isMobile);
  const scope = center.getByTestId("household-distribution-scope");
  await expect(scope).toContainText("Geändert und enthalten: Einkommensteuer.");
  await expect(scope).toContainText("Umsatzsteuer");
  await expect(scope).toContainText("hier nicht abgebildet");
  await page.screenshot({ path: `test-results/issue-107-mixed-scope-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});
