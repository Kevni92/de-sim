import { expect, test } from "@playwright/test";

test("führt vom Onboarding in das vollständige Dashboard", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Ein neutraler Blick auf den deutschen Staatshaushalt." })).toBeVisible();
  await page.getByRole("button", { name: "Simulation starten" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ausgaben" }).first()).toBeVisible();
  await expect(page.getByText("Wasserfall Budgetsaldo")).toBeVisible();
});

test("öffnet die Einkommensteuer-Detailansicht und reagiert live", async ({ page }) => {
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

test("zeigt Quellen und Methodik in einem Drawer", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Quelle" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Quelle und Methodik")).toBeVisible();
  await expect(dialog.getByText("Institution")).toBeVisible();
  await expect(dialog.getByText("Bekannte Grenzen")).toBeVisible();
});

test("speichert und lädt ein Szenario über Worker und IndexedDB", async ({ page }) => {
  const name = `Milestone 1 ${Date.now()}`;
  await page.goto("./#/dashboard");
  await page.getByLabel("Szenarioname").fill(name);
  await page.getByRole("button", { name: /Speichern/ }).click();
  await expect(page.getByRole("status")).toContainText("lokal gespeichert");
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
});

test("öffnet den neutralen Szenariovergleich", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Vergleich öffnen" }).click();
  await expect(page).toHaveURL(/#\/vergleich$/);
  await expect(page.getByRole("heading", { name: "Szenariovergleich" })).toBeVisible();
  await expect(page.getByText("Zentrale Politikeinstellungen")).toBeVisible();
});

test("bietet auf Mobilgeräten die vier Dashboard-Tabs", async ({ page, isMobile }) => {
  test.skip(!isMobile, "nur im mobilen Projekt relevant");
  await page.goto("./#/dashboard");
  const tablist = page.getByRole("tablist", { name: "Dashboardbereiche" });
  await expect(tablist).toBeVisible();
  await tablist.getByRole("tab", { name: "Steuern" }).click();
  await expect(page.getByRole("heading", { name: "Einnahmen" }).first()).toBeVisible();
});
