import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test("ändert Modellstufe und Zeitraum nur zentral und übernimmt sie auf allen Fachseiten", async ({ page, isMobile }) => {
  await page.goto("./#/einnahmen");
  await page.getByText("Mögliche Folgewirkungen", { exact: true }).click();

  const revenueContext = page.getByTestId("scenario-calculation-summary");
  await expect(revenueContext.getByText("Mit kurzfristigen Reaktionen", { exact: true })).toBeVisible();
  await expect(revenueContext.getByText("5 Jahre", { exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: /Modellstufe/ })).toHaveCount(0);

  await revenueContext.getByRole("button", { name: "Im Szenario ändern" }).click();
  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const modelLevel = dialog.getByLabel("Modellstufe im Dialog");
  await expect(modelLevel).toBeFocused();
  await modelLevel.selectOption("statisch");
  await dialog.getByLabel("Zeithorizont").selectOption("10");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await expect(revenueContext.getByText("Nur direkte Wirkung", { exact: true })).toBeVisible();
  await expect(revenueContext.getByText("10 Jahre", { exact: true })).toBeVisible();

  await page.goto("./#/einkommensteuer");
  const taxContext = page.getByTestId("scenario-calculation-summary");
  await expect(taxContext.getByText("Nur direkte Wirkung", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(taxContext.getByText("10 Jahre", { exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: /Modellstufe/ })).toHaveCount(0);

  await page.goto("./#/ausgaben");
  const expenseContext = page.getByTestId("scenario-calculation-summary");
  await expect(expenseContext.getByText("Nur direkte Wirkung", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(expenseContext.getByText("10 Jahre", { exact: true })).toBeVisible();

  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId("scenario-calculation-summary").getByText("Nur direkte Wirkung", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("scenario-calculation-summary").getByText("10 Jahre", { exact: true })).toBeVisible();

  await page.screenshot({ path: `test-results/issue-36-calculation-context-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});
