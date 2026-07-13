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
  await page.screenshot({ path: "test-results/milestone-1-dashboard.png", fullPage: true });
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
  test.skip(isMobile, "Die kompakte App-Bar zeigt Speichern erst in einem späteren Mobilfluss");
  const name = `Milestone 1 ${Date.now()}`;
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

test("bietet mobil Tabs, Quellen und die Einkommensteuer-Detailseite", async ({ page, isMobile }) => {
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
});
