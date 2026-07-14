import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

test("Wirkungs-Engine übernimmt den zentralen Berechnungsrahmen automatisch", async ({ page }, testInfo) => {
  await page.goto("./#/einkommensteuer");
  const modelBasis = page.getByTestId("model-basis-status");
  await expect(modelBasis.getByText(/^bereit(?: mit Qualitätswarnung)?$/)).toBeVisible({ timeout: 90_000 });

  await page.goto("./#/wirkungen");
  await expect(page.getByRole("heading", { name: "Indirekte und langfristige Wirkungen" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Keine sichere Prognose.")).toBeVisible();
  await expect(page.getByText("Kita-Verfügbarkeit und Betreuung", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("effect-timeline")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("effect-timeline").getByRole("row")).toHaveCount(7, { timeout: 60_000 });

  const context = page.getByTestId("scenario-calculation-summary");
  await expect(context).toHaveAttribute("data-status", "current", { timeout: 60_000 });
  await expect(context.getByText("Mit kurzfristigen Reaktionen", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Langfristig", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "20 J.", exact: true })).toHaveCount(0);

  await context.getByRole("button", { name: "Im Szenario ändern" }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(dialog.getByLabel("Modellstufe im Dialog")).toBeFocused();
  await dialog.getByLabel("Modellstufe im Dialog").selectOption("langfrist");
  await dialog.getByLabel("Zeithorizont").selectOption("20");
  await expect(context).toHaveAttribute("data-status", /updating|stale/);
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await expect(context.getByText("Langfristiges Szenario", { exact: true })).toBeVisible();
  await expect(context.getByText("20 Jahre", { exact: true })).toBeVisible();
  await expect(context).toHaveAttribute("data-status", "current", { timeout: 90_000 });
  await expect(page.getByTestId("effect-timeline").getByRole("row")).toHaveCount(22, { timeout: 90_000 });
  await expect(page.getByText("Unsicherheitsband", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Geburtenentwicklung, Altersstruktur und Demografie/ }).click();
  await expect(page.getByText("Nicht berechnet", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Das Modul liefert bewusst keine monetäre Punktzahl.")).toBeVisible();

  await page.screenshot({ path: `test-results/issue-36-effects-context-${testInfo.project.name}.png`, fullPage: true });
});
