import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 210_000 });

test("ordnet Wirkungen automatisch Reformmodulen und Vergleichsebenen zu", async ({ page, isMobile }, testInfo) => {
  await page.goto("./#/einnahmen");
  await page.getByLabel("Regelsteuersatz Wert").fill("20");
  const revenueFollowUp = page.getByTestId("reform-follow-up-section");
  const revenueSummary = revenueFollowUp.locator("summary");
  await revenueSummary.focus();
  await revenueSummary.press("Enter");

  const vatCard = page.getByTestId("context-effect-vat-price-consumption");
  await expect(vatCard).toBeVisible({ timeout: 90_000 });
  await expect(vatCard.getByText("Preisweitergabe und Konsumreaktion", { exact: true })).toBeVisible();
  await expect(vatCard.getByText("Gerichtete Wirkung ohne Punktwert", { exact: true })).toBeVisible();
  await expect(vatCard).not.toContainText("Modellierter Pfad, ohne direkte Budgetwirkung");
  await expect(page.getByRole("button", { name: /Neu berechnen/i })).toHaveCount(0);
  await vatCard.getByRole("button", { name: "Berechnung, Annahmen und Quellen" }).click();
  const sourceDialog = page.getByRole("dialog", { name: /Nachweis:/ });
  await expect(sourceDialog).toBeVisible();
  await sourceDialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.goto("./#/ausgaben");
  await page.getByRole("button", { name: /Kitas und Familienleistungen/ }).click();
  await page.getByLabel("Betreuungsplätze Wert").fill("112");
  await page.getByLabel("Personal- und Qualitätskosten Wert").fill("120");

  const effectsPanel = page.getByTestId("context-effects-panel");
  await expect(effectsPanel).toHaveAttribute("data-status", "current", { timeout: 120_000 });
  const familyCard = page.getByTestId("context-effect-family-kita-path");
  await expect(familyCard.getByText("Kita-Verfügbarkeit und Betreuung", { exact: true })).toBeVisible();
  await expect(familyCard.getByText("Modellierter Pfad, ohne direkte Budgetwirkung", { exact: true })).toBeVisible();
  await expect(familyCard.locator(".context-effect-meta")).toContainText(/Haushalte|Personen/);

  const dependencyCard = page.getByTestId("context-effect-family-labour-detail");
  await expect(dependencyCard).toContainText("nicht zusätzlich summiert");
  const unavailableCard = page.getByTestId("context-effect-family-demography-boundary");
  await expect(unavailableCard.getByText("Nicht ausreichend belegt", { exact: true })).toBeVisible();
  await expect(unavailableCard).not.toContainText("Modellierter Pfad, ohne direkte Budgetwirkung");

  await page.getByLabel("Betreuungsplätze Wert").fill("114");
  await expect(effectsPanel).toHaveAttribute("data-status", /updating|stale/);
  await expect(effectsPanel).toHaveAttribute("data-status", "current", { timeout: 120_000 });

  if (isMobile) await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/issue-37-context-effects-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });

  await page.goto("./#/vergleich");
  const comparison = page.getByTestId("effect-level-comparison");
  await expect(comparison).toBeVisible();
  await expect(comparison.getByText("Direkte fiskalische Wirkung", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Kurzfristige mögliche Reaktionen", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Fiskalische Rückkopplungen", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Langfristige Szenariopfade", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Nicht monetäre Wirkungen", { exact: true })).toBeVisible();
  await expect(page.getByText("Gesamtwirkung", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `test-results/issue-37-effect-comparison-${testInfo.project.name}.png`, fullPage: true });

  const advancedLink = comparison.getByRole("button", { name: /Vollständige Wirkungsmodelle prüfen/ });
  await advancedLink.focus();
  await advancedLink.press("Enter");
  await expect(page).toHaveURL(/#\/wirkungen$/);
  await expect(page.getByRole("heading", { name: "Indirekte und langfristige Wirkungen" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("button", { name: "Wirkungen", exact: true })).toHaveCount(0);
});
