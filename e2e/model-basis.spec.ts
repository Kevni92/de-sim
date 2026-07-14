import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function expectModelBasisReady(basis: Locator) {
  await expect(basis).toBeVisible();
  await expect(basis.getByText("Verwendete Datenbasis", { exact: true })).toBeVisible();
  await expect(basis.getByText(/^(innerhalb Toleranz|Warnung)$/)).toBeVisible({ timeout: 60_000 });
}

async function openScenarioPanel(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
    const mobileMenu = page.getByRole("dialog", { name: "Hauptmenü" });
    await mobileMenu.getByRole("button", { name: "Szenario verwalten" }).click();
  } else {
    await page.getByRole("button", { name: "Szenario", exact: true }).click();
  }

  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    await Promise.all(databases.map(({ name }) => name && new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    })));
  });
});

test("stellt für Einkommensteuer automatisch eine Modellbasis bereit", async ({ page }) => {
  await page.goto("./#/einkommensteuer");

  const basis = page.locator(".income-tax-population-banner");
  await expectModelBasisReady(basis);
  await expect(page.getByLabel("Grundfreibetrag Wert")).toBeEnabled();

  await page.getByLabel("Grundfreibetrag Wert").fill("15000");
  await expect(page.getByText("Verteilungswirkung", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/issue-35-standard-model-basis.png", fullPage: true });
});

test("verwendet dieselbe Standard-Modellbasis nach einem neuen Szenario weiter", async ({ page, isMobile }) => {
  await page.goto("./#/einkommensteuer");
  const basis = page.locator(".income-tax-population-banner");
  await expectModelBasisReady(basis);
  const firstBasis = await basis.locator("strong").first().textContent();

  const dialog = await openScenarioPanel(page, isMobile);
  await dialog.getByRole("button", { name: "Neu", exact: true }).click();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.reload();
  await expectModelBasisReady(basis);
  await expect(basis.locator("strong").first()).toHaveText(firstBasis ?? "");
});
