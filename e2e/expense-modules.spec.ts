import { expect, test, type Locator } from "@playwright/test";

async function openSourceDrawer(button: Locator, dialog: Locator) {
  await expect(button).toBeVisible();
  await expect.poll(async () => {
    if (await dialog.isVisible()) return true;
    await button.click();
    return dialog.isVisible();
  }, { timeout: 10_000, intervals: [200, 400, 800] }).toBe(true);
}

test("öffnet Bürgergeld aus dem Dashboard und berechnet Änderungen live", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Bürgergeld bearbeiten" }).click();
  await expect(page).toHaveURL(/#\/ausgaben$/);
  await expect(page.getByRole("heading", { name: "Ausgaben und Leistungen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bürgergeld und Unterkunft" })).toBeVisible();
  await page.getByLabel("Regelbedarfsniveau Wert").fill("105");
  await expect(page.getByTestId("expense-module-value")).toHaveText("55,4 Mrd. €");
  await expect(page.getByText("Direkte Wirkung").first()).toBeVisible();
  await expect(page.getByText("Folgewirkung").first()).toBeVisible();
  await page.screenshot({ path: "test-results/milestone-6-expense-modules.png", fullPage: true });
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

test("sichert Ausgabenparameter per Worker und IndexedDB", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Nutzerfluss");
  await page.goto("./#/ausgaben");
  const housing = page.getByLabel("Unterkunfts- und Heizkosten Wert");
  await housing.fill("112");
  await expect(housing).toHaveValue("112");
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByLabel("Unterkunfts- und Heizkosten Wert")).toHaveValue("112");
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