import { expect, test, type Locator } from "@playwright/test";

function parseGermanValue(text: string) {
  const match = text.trim().replaceAll("−", "-").match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!match) throw new Error(`Kein Zahlenwert in „${text}“ gefunden.`);
  return Number(match[0].replace(",", "."));
}

async function expectDisplayedDifference(row: Locator) {
  const baseline = parseGermanValue(await row.getByTestId("baseline").innerText());
  const scenario = parseGermanValue(await row.getByTestId("scenario").innerText());
  const differenceText = await row.getByTestId("difference").innerText();
  expect(differenceText).toMatch(/^[+−±]/);
  const difference = parseGermanValue(differenceText);
  expect(Math.abs(difference - (scenario - baseline))).toBeLessThanOrEqual(0.16);
}

test("ordnet Baseline, Szenario, Differenz und Band für alle Zieljahre zu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./#/langfrist");

  const targetYear = page.getByLabel("Zieljahr", { exact: true });
  const headers = page.locator(".long-term-comparison-table thead th");
  await expect(headers).toHaveText(["Kennzahl", "Baseline", "Szenario", "Differenz", "Szenarioband"]);
  await expect(page.locator(".long-term-data-table thead th").nth(3)).toHaveText("Beitragszahlende je 100 Rentenbeziehende");

  for (const year of [2030, 2040, 2050, 2070]) {
    await targetYear.selectOption(String(year));
    await expect(page.getByRole("region", { name: `Langfristkennzahlen für ${year}` })).toBeVisible();
    await expect(page.locator(".long-term-comparison-table caption")).toContainText(String(year));

    for (const id of ["population", "workforce", "contributors-per-pensioners", "pension-balance"]) {
      await expectDisplayedDifference(page.getByTestId(`long-term-row-${id}`));
    }

    const population = page.getByTestId("long-term-row-population");
    const workforce = page.getByTestId("long-term-row-workforce");
    await expect(population.getByTestId("band")).toHaveText("Kein Band berechnet");
    await expect(workforce.getByTestId("band")).toHaveText("Kein Band berechnet");

    const contributors = page.getByTestId("long-term-row-contributors-per-pensioners");
    const contributorMetric = page.locator(".long-term-metric").filter({ hasText: "Beitragszahlende je 100 Rentenbeziehende" }).first();
    await expect(contributors.getByTestId("scenario")).toHaveText(await contributorMetric.locator("strong").innerText());
    const contributorBaselineNote = await contributorMetric.locator("small").innerText();
    const contributorBaseline = contributorBaselineNote.match(/^Baseline ([\d,.]+)/)?.[1];
    expect(contributorBaseline).toBeDefined();
    await expect(contributors.getByTestId("baseline")).toHaveText(contributorBaseline!);
    await expect(contributors.getByTestId("difference")).toContainText("je 100 Rentenbeziehende");
    await expect(contributors.getByTestId("band")).toContainText("je 100 Rentenbeziehende");
    await expect(contributors.getByTestId("band")).toContainText("bis");

    const balance = page.getByTestId("long-term-row-pension-balance");
    const balanceMetric = page.locator(".long-term-metric").filter({ hasText: "Saldo der Alterssicherung" });
    await expect(balance.getByTestId("scenario")).toHaveText(await balanceMetric.locator("strong").innerText());
    await expect(balance.getByTestId("baseline")).toHaveText((await balanceMetric.locator("small").innerText()).replace("Baseline ", ""));
    await expect(balance.getByTestId("difference")).toContainText("Mrd. €");
    await expect(balance.getByTestId("band")).toContainText("bis");

    if (year === 2030) await page.screenshot({ path: "test-results/issue-98-long-term-table-2030-desktop.png", fullPage: true });
  }
});

test("hält die Langfristtabelle mobil zuordenbar und per Tastatur horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/langfrist");
  await page.getByLabel("Zieljahr", { exact: true }).selectOption("2070");

  const region = page.getByRole("region", { name: "Langfristkennzahlen für 2070" });
  await expect(region).toBeVisible();
  await expect(page.locator(".long-term-comparison-table thead th")).toHaveText(["Kennzahl", "Baseline", "Szenario", "Differenz", "Szenarioband"]);
  await expect(page.getByTestId("long-term-row-contributors-per-pensioners").getByTestId("baseline")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/issue-98-long-term-table-mobile.png", fullPage: true });

  for (let attempt = 0; attempt < 30 && !(await region.evaluate((element) => element === document.activeElement)); attempt += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(region).toBeFocused();
  await expect(region).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
