import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test("setzt Kapitalertragsteuer flexibel und erhält bestätigte Werte in Verlauf, Export, Import und Entwurf", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-Prüfung für Szenarioverlauf und Dateiaustausch");
  await page.goto("./#/einnahmen");

  const capitalTax = page.locator(".revenue-module-list").getByRole("button", { name: /Kapitalertragsteuer/ });
  await capitalTax.click();
  const rate = page.getByLabel("Abgeltungsteuersatz Wert");
  const slider = page.getByLabel("Abgeltungsteuersatz Regler");
  await expect(rate).toHaveValue("25");
  await expect(page.getByText("Baseline: 25 %", { exact: true })).toBeVisible();
  await expect(page.locator(".reform-primary-control .parameter-baseline-marker")).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuetext", "25 %");

  await page.getByRole("button", { name: "Bereich erweitern" }).click();
  await expect(slider).toHaveAttribute("max", "100");
  await expect(rate).toHaveValue("25");
  await page.getByRole("button", { name: "Standardbereich wiederherstellen" }).click();
  await expect(slider).toHaveAttribute("max", "50");
  await expect(rate).toHaveValue("25");

  await slider.focus();
  for (let step = 0; step < 15; step += 1) await slider.press("ArrowRight");
  await expect(rate).toHaveValue("40");
  const increase = page.getByRole("button", { name: "Abgeltungsteuersatz erhöhen" });
  const decrease = page.getByRole("button", { name: "Abgeltungsteuersatz verringern" });
  await increase.focus();
  await page.keyboard.press("Enter");
  await expect(rate).toHaveValue("41");
  await decrease.focus();
  await page.keyboard.press("Enter");
  await expect(rate).toHaveValue("40");

  await rate.fill("80");
  await expect(page.locator(".reform-primary-control .parameter-current-value")).toHaveText("40 %");
  await rate.press("Enter");
  await expect(rate).toHaveValue("80");
  await expect(slider).toHaveAttribute("max", "100");
  await expect(page.getByText(/Außerhalb des fachlich geprüften Bereichs.*Extrapolation/)).toBeVisible();
  await expect(rate).toHaveAttribute("aria-invalid", "false");

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(rate).toHaveValue("40");
  await page.getByRole("button", { name: "Wiederholen" }).click();
  await expect(rate).toHaveValue("80");

  await rate.fill("");
  await rate.press("Enter");
  await expect(rate).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Gib eine vollständige" })).toBeVisible();
  await expect(page.locator(".reform-primary-control .parameter-current-value")).toHaveText("80 %; außerhalb des fachlich geprüften Bereichs");
  await rate.press("Escape");
  await expect(rate).toHaveValue("80");

  await rate.fill("-5");
  await rate.press("Enter");
  await expect(rate).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "mindestens 0 %" })).toBeVisible();
  await expect(page.locator(".reform-primary-control .parameter-current-value")).toHaveText("80 %; außerhalb des fachlich geprüften Bereichs");
  await rate.press("Escape");
  await expect(rate).toHaveValue("80");

  await page.getByRole("button", { name: "Abgeltungsteuersatz auf Baseline zurücksetzen" }).click();
  await expect(rate).toHaveValue("25");
  await expect(slider).toHaveAttribute("max", "100");
  await page.getByRole("button", { name: "Standardbereich wiederherstellen" }).click();
  await expect(slider).toHaveAttribute("max", "50");

  await rate.fill("80");
  await rate.press("Enter");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const scenarioDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const downloadPromise = page.waitForEvent("download");
  await scenarioDialog.getByRole("button", { name: "Szenario herunterladen" }).click();
  const download = await downloadPromise;
  const exportPath = await download.path();
  expect(exportPath).not.toBeNull();
  const exported = JSON.parse(await readFile(exportPath!, "utf8")) as { scenario: { revenueChanges: Record<string, number> } };
  expect(exported.scenario.revenueChanges["param.kap.rate"]).toBe(80);
  await scenarioDialog.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.reload();
  await page.locator(".revenue-module-list").getByRole("button", { name: /Kapitalertragsteuer/ }).click();
  await expect(page.getByLabel("Abgeltungsteuersatz Wert")).toHaveValue("80");

  await page.getByLabel("Abgeltungsteuersatz Wert").fill("40");
  await page.getByLabel("Abgeltungsteuersatz Wert").press("Enter");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const importDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await importDialog.getByLabel("Szenario-Datei auswählen").setInputFiles(exportPath!);
  const guard = page.getByTestId("scenario-guard-dialog");
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Entwurf verwerfen und fortfahren" }).click();
  await expect(page.getByLabel("Abgeltungsteuersatz Wert")).toHaveValue("80");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
});

test("erweitert absolute Parameter und bleibt auf Mobilgeräten ohne Seitenüberlauf bedienbar", async ({ page, isMobile }) => {
  await page.goto("./#/einnahmen");
  await page.locator(".revenue-module-list").getByRole("button", { name: /Kapitalertragsteuer/ }).click();
  await page.getByText("Erweiterte Parameter", { exact: true }).click();

  const allowance = page.getByLabel("Sparer-Pauschbetrag Wert");
  const allowanceControl = page.getByTestId("parameter-saverAllowance");
  const slider = allowanceControl.getByLabel("Sparer-Pauschbetrag Regler");
  await expect(allowance).toHaveValue("1.000");
  await allowance.fill("12.000");
  await allowance.press("Enter");
  await expect(allowance).toHaveValue("12.000");
  await expect(slider).toHaveAttribute("max", "20000");
  await expect(allowanceControl.getByText(/Außerhalb des fachlich geprüften Bereichs.*Extrapolation/)).toBeVisible();
  await expect(allowance).toHaveAttribute("aria-invalid", "false");

  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const controlBounds = await allowanceControl.boundingBox();
  expect(controlBounds).not.toBeNull();
  expect(controlBounds!.x).toBeGreaterThanOrEqual(0);
  expect(controlBounds!.x + controlBounds!.width).toBeLessThanOrEqual(viewportWidth + 1);
  if (isMobile) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewportWidth + 1);
  }
  await page.screenshot({ path: `test-results/issue-82-flexible-parameters-${isMobile ? "mobile" : "desktop"}.png`, fullPage: true });
});
