import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test("öffnet die Langfristansicht aus dem Szenariovergleich", async ({ page }) => {
  await page.goto("./#/vergleich");
  await expect(page.getByRole("heading", { name: "Szenariovergleich", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Langfristansicht öffnen/ }).click();
  await expect(page).toHaveURL(/#\/langfrist$/);
  await expect(page.getByTestId("long-term-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warum verändern sich Bevölkerung, Arbeitskräfte und Alterssicherung?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Vier Kernkennzahlen" })).toBeVisible();
});

test("vergleicht das Zieljahr 2050 mit einer zugänglichen Zeitreihe", async ({ page }) => {
  await page.goto("./#/langfrist");
  await page.getByLabel("Zieljahr", { exact: true }).selectOption("2050");
  await expect(page.getByText("Einordnung für 2050:")).toBeVisible();
  await expect(page.getByRole("table", { name: /Zeitreihe der zentralen Szenariowerte/ })).toBeVisible();
  await expect(page.getByText("Modellgrenzen und Rechenweg anzeigen")).toBeVisible();
  await page.screenshot({ path: "test-results/issue-70-long-term-desktop.png", fullPage: true });
});
