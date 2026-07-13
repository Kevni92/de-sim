import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("zeigt das Dashboard im Staat-sKlarheit-Design", async ({ page }) => {
  await expect(page.getByText("Deutschland-Simulator").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Einnahmen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ausgaben" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wirkung des Reformentwurfs" })).toBeVisible();
});

test("öffnet die nachvollziehbare Quellenansicht", async ({ page }) => {
  await page.getByRole("button", { name: "Quelle" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Quelle und Methodik")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Öffentlicher Gesamthaushalt|Datensammlung zur Steuerpolitik/ })).toBeVisible();
});

test("speichert ein Szenario dauerhaft in IndexedDB", async ({ page }) => {
  const name = `Playwright ${Date.now()}`;
  await page.getByLabel("Szenarioname").fill(name);
  await page.getByRole("button", { name: /Speichern/ }).click();
  await expect(page.getByRole("status")).toContainText("lokal gespeichert");
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
});
