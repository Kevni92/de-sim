import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("zeigt Szenarioverwaltung und Speicherort in Alltagssprache auf Desktop und Mobil", async ({ page }) => {
  await page.goto("./#/dashboard");

  const savedList = page.locator(".saved-scenarios");
  await expect(savedList).toContainText("Nur in diesem Browser gespeichert");
  await expect(savedList).toContainText("Noch keine Szenarien gespeichert");
  await expect(savedList).not.toContainText(/IndexedDB|lokaler Worker/i);
  await page.screenshot({ path: "test-results/issue-106-scenario-management-empty.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(savedList).toContainText("Noch keine Szenarien gespeichert");
  await page.screenshot({ path: "test-results/issue-106-scenario-management-empty-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  let panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(panel.getByLabel("Szenarioname im Dialog")).toBeVisible();
  await expect(panel.getByLabel("Szenariobeschreibung")).toBeVisible();
  await expect(panel.getByTestId("scenario-save-status")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Szenario speichern", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Szenario herunterladen", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Szenario aus Datei übernehmen", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Szenario-Daten kopieren", exact: true })).toBeVisible();
  await expect(panel.getByText(/Die Szenario-Datei und die kopierten Szenario-Daten nutzen das JSON-Format.*anderes Gerät/s)).toBeVisible();

  const standardCopy = await panel.locator(".scenario-scroll").innerText();
  expect(standardCopy).not.toMatch(/IndexedDB|lokaler Worker|Zentrales Szenariomodell|Quellenkennungen|long-term-effects-/i);
  const technicalDetails = panel.locator("details.scenario-technical-details");
  await expect(technicalDetails).not.toHaveAttribute("open", "");
  await page.screenshot({ path: "test-results/issue-106-scenario-management-desktop.png", fullPage: true });

  const summary = technicalDetails.locator("summary");
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(technicalDetails).toHaveAttribute("open", "");
  await expect(technicalDetails).toContainText("Modellversion");
  await expect(technicalDetails).toContainText("Interne Szenario-ID");
  await expect(technicalDetails).toContainText("Quellenkennungen");
  await expect(technicalDetails).toContainText("source-budget");

  await panel.getByLabel("Szenarioname im Dialog").fill("Meine Beispielvariante");
  await panel.getByLabel("Szenariobeschreibung").fill("Eine verständliche Beschreibung der Variante.");
  await panel.getByRole("button", { name: "Szenario speichern", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();

  await expect(savedList).toContainText("Meine Beispielvariante");
  await expect(savedList).toContainText("Eine verständliche Beschreibung der Variante.");
  await expect(savedList).toContainText("Zuletzt gespeichert:");
  await page.screenshot({ path: "test-results/issue-106-scenario-management-saved-list.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(savedList).toContainText("Meine Beispielvariante");
  await expect(savedList).toContainText("Eine verständliche Beschreibung der Variante.");
  await page.screenshot({ path: "test-results/issue-106-scenario-management-saved-list-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  await page.getByRole("dialog", { name: "Hauptmenü" }).getByRole("button", { name: "Szenario verwalten" }).click();
  panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(panel.getByRole("button", { name: "Szenario herunterladen", exact: true })).toBeVisible();
  await expect(panel.getByText(/Dein Entwurf wird nur in diesem Browser/)).toBeVisible();
  const mobileTechnicalDetails = panel.locator("details.scenario-technical-details");
  const mobileSummary = mobileTechnicalDetails.locator("summary");
  await mobileSummary.focus();
  await page.keyboard.press("Enter");
  await expect(mobileTechnicalDetails).toHaveAttribute("open", "");
  await page.screenshot({ path: "test-results/issue-106-scenario-management-mobile.png", fullPage: true });
  const pageWidths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(pageWidths.page).toBeLessThanOrEqual(pageWidths.viewport + 1);
});

test("Szenario-Dateien behalten Beschreibung, Werte und technische Referenzen beim Übertragen", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Einkommensteuer bearbeiten" }).click();
  await page.getByLabel("Grundfreibetrag Wert").fill("14500");
  await page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" }).click();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();

  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await panel.getByLabel("Szenarioname im Dialog").fill("Mitnahme-Test");
  await panel.getByLabel("Szenariobeschreibung").fill("Diese Variante kann ich auf ein anderes Gerät mitnehmen.");
  await panel.getByRole("button", { name: "Szenario speichern", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");

  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Szenario herunterladen", exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    schemaVersion: number;
    scenario: {
      name: string;
      description: string;
      incomeTax: { allowance: number };
      modelVersion: string;
      sourceIds: string[];
    };
  };
  expect(exported.schemaVersion).toBe(7);
  expect(exported.scenario.name).toBe("Mitnahme-Test");
  expect(exported.scenario.description).toBe("Diese Variante kann ich auf ein anderes Gerät mitnehmen.");
  expect(exported.scenario.incomeTax.allowance).toBe(14_500);
  expect(exported.scenario.modelVersion).toBe("long-term-effects-0.8.0");
  expect(exported.scenario.sourceIds).toContain("source-budget");

  await panel.getByLabel("Szenariobeschreibung").fill("Ungesicherte Änderung vor dem Import.");
  await panel.getByLabel("Szenario-Datei auswählen").setInputFiles(downloadPath!);
  const replacement = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await expect(replacement).toBeVisible();
  await replacement.getByRole("button", { name: "Entwurf verwerfen und fortfahren" }).click();
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Mitnahme-Test");
  await expect(panel.getByLabel("Szenariobeschreibung")).toHaveValue("Diese Variante kann ich auf ein anderes Gerät mitnehmen.");
  const details = panel.locator("details.scenario-technical-details");
  await details.locator("summary").click();
  await expect(details).toContainText("long-term-effects-0.8.0");
  await expect(details).toContainText("source-budget");
});
