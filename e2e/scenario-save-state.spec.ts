import { expect, test } from "@playwright/test";

test("unterscheidet Browser-Entwurf, gespeicherte Fassung und neue Variante", async ({ page }) => {
  await page.goto("./#/dashboard");
  await page.getByLabel("Szenarioname").fill("Ausgangsfassung");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const status = dialog.getByTestId("scenario-save-status");
  const draftStatus = status.locator(".scenario-storage-card").nth(0);
  const savedStatus = status.locator(".scenario-storage-card").nth(1);
  await expect(draftStatus.locator("strong")).toHaveText("Gesichert");
  await expect(draftStatus).toContainText("Zuletzt gesichert:");
  await expect(savedStatus.locator("strong")).toHaveText("Noch nicht gespeichert");

  const description = dialog.getByLabel("Szenariobeschreibung");
  await description.fill("Gespeicherte Ursprungsfassung");
  await dialog.getByRole("button", { name: "Szenario speichern" }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  await expect(savedStatus.locator("strong")).toHaveText("Entspricht dem gespeicherten Stand");

  await description.fill("Änderungen im Browser-Entwurf");
  await expect(savedStatus.locator("strong")).toHaveText("Änderungen seit gespeichertem Stand");
  await expect(draftStatus.locator("strong")).toHaveText("Gesichert");
  await page.waitForTimeout(400);
  await page.reload();

  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const reloadedDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const reloadedStatus = reloadedDialog.getByTestId("scenario-save-status");
  await expect(reloadedDialog.getByLabel("Szenariobeschreibung")).toHaveValue("Änderungen im Browser-Entwurf");
  await expect(reloadedStatus.locator(".scenario-storage-card").nth(0).locator("strong")).toHaveText("Gesichert");
  await expect(reloadedStatus.locator(".scenario-storage-card").nth(1).locator("strong")).toHaveText("Änderungen seit gespeichertem Stand");

  await reloadedDialog.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  await expect(reloadedStatus.locator(".scenario-storage-card").nth(1).locator("strong")).toHaveText("Entspricht dem gespeicherten Stand");

  await reloadedDialog.getByLabel("Szenariobeschreibung").fill("Inhalt der neuen Variante");
  await reloadedDialog.getByRole("button", { name: "Als neue Variante sichern" }).click();
  await expect(page.locator(".toast")).toContainText("Neue Szenariovariante lokal gespeichert");
  await expect(page.locator(".saved-scenarios")).toContainText("Ausgangsfassung");
  await expect(page.locator(".saved-scenarios")).toContainText("Ausgangsfassung (Kopie)");
  await expect(page.locator(".saved-scenarios header strong")).toHaveText("2");

  await page.getByText("Ausgangsfassung", { exact: true }).click();
  await page.getByRole("button", { name: "Szenario", exact: true }).click();
  const originalDialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  await expect(originalDialog.getByLabel("Szenariobeschreibung")).toHaveValue("Änderungen im Browser-Entwurf");
});

test("macht Speichern auch mobil sichtbar und per Tastatur nutzbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  await page.getByRole("dialog", { name: "Hauptmenü" }).getByRole("button", { name: "Szenario verwalten" }).click();

  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const name = dialog.getByLabel("Szenarioname im Dialog");
  await name.fill("Mobil gespeichertes Szenario");
  const save = dialog.getByRole("button", { name: "Szenario speichern" });
  await save.focus();
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast")).toContainText("Szenario lokal gespeichert");
  await expect(dialog.getByTestId("scenario-save-status")).toContainText("Entspricht dem gespeicherten Stand");

  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
});

test("meldet einen fehlgeschlagenen Autosave und hält Eingaben für den erneuten Versuch", async ({ page }) => {
  await page.addInitScript(`
    (() => {
      const originalPostMessage = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...args) {
        if (message?.type === "draft:save" && sessionStorage.getItem("fail-next-draft-save") === "true") {
          sessionStorage.removeItem("fail-next-draft-save");
          queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
            data: { id: message.id, ok: false, error: "Test-Speicherfehler" },
          })));
          return;
        }
        return originalPostMessage.call(this, message, ...args);
      };
    })();
  `);
  await page.goto("./#/dashboard");
  await page.getByRole("button", { name: "Szenario", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Szenario verwalten" });
  const status = dialog.getByTestId("scenario-save-status");
  const draftCard = status.locator(".scenario-storage-card").nth(0);
  await expect(draftCard.locator("strong")).toHaveText("Gesichert");
  await page.evaluate(() => sessionStorage.setItem("fail-next-draft-save", "true"));

  const description = dialog.getByLabel("Szenariobeschreibung");
  await description.fill("Diese Eingabe bleibt erhalten");
  await expect(draftCard.locator("strong")).toHaveText("Sicherung fehlgeschlagen");
  await expect(dialog.getByRole("alert")).toContainText("Test-Speicherfehler");
  await expect(description).toHaveValue("Diese Eingabe bleibt erhalten");
  await expect(page.locator(".toast")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(draftCard.locator("strong")).toHaveText("Gesichert");
  await expect(description).toHaveValue("Diese Eingabe bleibt erhalten");
  await expect(draftCard).toContainText("Zuletzt gesichert:");
});
