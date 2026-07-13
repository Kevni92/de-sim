import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

test("Wirkungs-Engine trennt Zeitpfad, Unsicherheit und unberechnete Bereiche", async ({ page }, testInfo) => {
  await page.goto("/de-sim/#/wirkungen");
  await expect(page.getByRole("heading", { name: "Indirekte und langfristige Wirkungen" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Keine sichere Prognose.")).toBeVisible();
  await expect(page.getByText("Kita-Verfügbarkeit und Betreuung", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("effect-timeline")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("effect-timeline").getByRole("row")).toHaveCount(7, { timeout: 45_000 });

  await page.getByRole("button", { name: "Langfristig", exact: true }).click();
  await page.getByRole("button", { name: "20 J.", exact: true }).click();
  await expect(page.getByTestId("effect-timeline").getByRole("row")).toHaveCount(22, { timeout: 45_000 });
  await expect(page.getByText("Unsicherheitsband", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Geburtenentwicklung, Altersstruktur und Demografie/ }).click();
  await expect(page.getByText("Nicht berechnet", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Das Modul liefert bewusst keine monetäre Punktzahl.")).toBeVisible();

  if (testInfo.project.name === "chromium") {
    await page.screenshot({ path: "test-results/milestone-8-long-term-effects.png", fullPage: true });
  }
});
