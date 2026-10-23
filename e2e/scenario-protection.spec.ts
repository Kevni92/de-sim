import { expect, test } from "@playwright/test";

test("fragt vor dem Löschen nach und erhält ein abgebrochenes Szenario", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await panel.getByLabel("Szenarioname im Dialog").fill("Zu löschendes Szenario");
  await panel.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(panel).toHaveCount(0);

  const list = page.locator(".saved-scenarios:visible");
  await expect(list).toContainText("Zu löschendes Szenario");
  const row = list.locator("li").filter({ has: page.getByText("Zu löschendes Szenario", { exact: true }) });
  await row.getByRole("button", { name: "Zu löschendes Szenario löschen" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Szenario löschen?" });
  await expect(confirmation).toContainText("Zu löschendes Szenario");
  await expect(confirmation.getByRole("button", { name: "Abbrechen" })).toBeFocused();
  await page.screenshot({ path: "test-results/scenario-protection-delete-confirmation.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Zu löschendes Szenario löschen" })).toBeFocused();
  await expect(list).toContainText("Zu löschendes Szenario");

  await row.getByRole("button", { name: "Zu löschendes Szenario löschen" }).click();
  await page.getByRole("alertdialog", { name: "Szenario löschen?" }).getByRole("button", { name: "Szenario löschen" }).click();
  await expect(page.locator(".saved-scenarios:visible li")).toHaveCount(0);
  await expect(page.locator(".saved-scenarios:visible")).toContainText("Noch keine Szenarien gespeichert");
  await expect(page.getByRole("button", { name: "Szenario", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const panelAfterDelete = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(panelAfterDelete.getByLabel("Szenarioname im Dialog")).toHaveValue("Zu löschendes Szenario");
});

test("schützt geänderte Entwürfe vor Neu und Laden, ohne unveränderte Entwürfe zu blockieren", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  let panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await panel.getByLabel("Szenarioname im Dialog").fill("Basis");
  await panel.getByLabel("Szenariobeschreibung").fill("Gespeicherte Fassung");
  await panel.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");

  await panel.getByRole("button", { name: "Neues Szenario", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Neues Szenario");
  const description = panel.getByLabel("Szenariobeschreibung");
  await description.fill("Ungespeicherte Arbeit");
  await panel.getByRole("button", { name: "Neues Szenario", exact: true }).click();
  let guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await expect(guard).toContainText("Neues Szenario");
  await page.screenshot({ path: "test-results/scenario-protection-replacement-desktop.png", fullPage: true });
  await guard.getByRole("button", { name: "Abbrechen" }).click();
  await expect(guard).toHaveCount(0);
  await expect(description).toHaveValue("Ungespeicherte Arbeit");

  await panel.getByRole("button", { name: "Neues Szenario", exact: true }).click();
  guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await guard.getByRole("button", { name: "Als Variante sichern und fortfahren" }).click();
  await expect(guard).toHaveCount(0);
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Neues Szenario");
  await expect(page.locator(".saved-scenarios:visible")).toContainText("Neues Szenario (Kopie)");

  const nextDescription = panel.getByLabel("Szenariobeschreibung");
  await nextDescription.fill("Noch nicht abgelegte Änderung");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(panel).toHaveCount(0);
  const original = page.locator(".saved-scenarios:visible li").filter({ has: page.getByText("Basis", { exact: true }) });
  await original.getByRole("button").first().click();
  guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await expect(guard).toContainText("das gespeicherte Szenario „Basis“ laden");
  await guard.getByRole("button", { name: "Abbrechen" }).click();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(panel.getByLabel("Szenariobeschreibung")).toHaveValue("Noch nicht abgelegte Änderung");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();

  await original.getByRole("button").first().click();
  guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await guard.getByRole("button", { name: "Entwurf verwerfen und fortfahren" }).click();
  await expect(guard).toHaveCount(0);
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Basis");
  await expect(panel.getByLabel("Szenariobeschreibung")).toHaveValue("Gespeicherte Fassung");
});

test("prüft Importe vor dem Wechsel und erhält den Entwurf bei Abbruch", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  const description = panel.getByLabel("Szenariobeschreibung");
  await description.fill("Entwurf vor dem Import");
  const importInput = panel.getByLabel("Szenario-Datei auswählen");

  await importInput.setInputFiles({ name: "ungueltig.json", mimeType: "application/json", buffer: Buffer.from("{kaputt") });
  await expect(page.locator(".toast")).toContainText("kein gültiges JSON");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(description).toHaveValue("Entwurf vor dem Import");

  const validImport = {
    name: "Importziel",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, scenario: { name: "Importziel", description: "Importierter Stand", legalYear: 2026, dataYear: 2024 } })),
  };
  await importInput.setInputFiles({ ...validImport, name: "importziel.json" });
  let guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await expect(guard).toContainText("Importziel");
  await guard.getByRole("button", { name: "Abbrechen" }).click();
  await expect(guard).toHaveCount(0);
  await expect(description).toHaveValue("Entwurf vor dem Import");

  await importInput.setInputFiles({ ...validImport, name: "importziel.json" });
  guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await guard.getByRole("button", { name: "Entwurf verwerfen und fortfahren" }).click();
  await expect(guard).toHaveCount(0);
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Importziel");
  await expect(description).toHaveValue("Importierter Stand");
});

test("blockiert den Wechsel bei fehlgeschlagener Varianten-Sicherung und ist mobil bedienbar", async ({ page }) => {
  await page.addInitScript(`
    (() => {
      const originalPostMessage = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...args) {
        if (message?.type === "scenarios:save" && sessionStorage.getItem("fail-next-scenario-save") === "true") {
          sessionStorage.removeItem("fail-next-scenario-save");
          queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
            data: { id: message.id, ok: false, error: "Test-Speicherfehler" },
          })));
          return;
        }
        return originalPostMessage.call(this, message, ...args);
      };
    })();
  `);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  await page.getByRole("dialog", { name: "Hauptmenü" }).getByRole("button", { name: "Szenario verwalten" }).click();
  const panel = page.getByRole("dialog", { name: "Szenario verwalten" });
  await panel.getByLabel("Szenarioname im Dialog").fill("Mobilbasis");
  await panel.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  const description = panel.getByLabel("Szenariobeschreibung");
  await description.fill("Mobil geänderte Arbeit");
  await page.evaluate(() => sessionStorage.setItem("fail-next-scenario-save", "true"));
  await panel.getByRole("button", { name: "Neues Szenario", exact: true }).click();
  const guard = page.getByRole("alertdialog", { name: "Deinen Entwurf sichern?" });
  await expect(guard.getByRole("button", { name: "Abbrechen" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(guard).toContainText("Mobilbasis");
  await page.keyboard.press("Shift+Tab");

  await guard.getByRole("button", { name: "Als Variante sichern und fortfahren" }).click();
  await expect(guard.getByRole("alert")).toContainText("Test-Speicherfehler");
  await expect(guard).toBeVisible();
  await expect(description).toHaveValue("Mobil geänderte Arbeit");
  await page.screenshot({ path: "test-results/scenario-protection-save-error-mobile.png", fullPage: true });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);

  await guard.getByRole("button", { name: "Als Variante sichern und fortfahren" }).click();
  await expect(guard).toHaveCount(0);
  await expect(panel.getByLabel("Szenarioname im Dialog")).toHaveValue("Neues Szenario");
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("tab", { name: "Szenario" }).click();
  await expect(page.locator(".saved-scenarios:visible")).toContainText("Mobilbasis (Kopie)");
});
