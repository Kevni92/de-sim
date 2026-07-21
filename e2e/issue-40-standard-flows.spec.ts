import { expect, test, type Page } from "@playwright/test";

const TECHNICAL_ID_PATTERN = /\b(?:sgb2-[0-9a-f]{8}|source-[a-z0-9-]+|synthetic-population-\d|run-[0-9a-f-]{8,})\b/;

async function openRevenueModule(page: Page) {
  await page.goto("./#/einnahmen");
  const summary = page.locator(".reform-result-layout");
  await expect(summary.getByTestId("reform-kpi-grid")).toBeVisible({ timeout: 45_000 });
  return summary;
}

async function openBuergergeld(page: Page) {
  await page.goto("./#/ausgaben");
  await expect(page.getByTestId("sgb2-editor")).toBeVisible();
  await expect(page.getByTestId("sgb2-standard-result-kpis")).toBeVisible({ timeout: 120_000 });
}

async function openDisclosure(section: ReturnType<Page["getByTestId"]>) {
  const summary = section.locator(":scope > summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(section).toHaveAttribute("open", "");
}

test.describe.configure({ timeout: 180_000 });

test.describe("Standardfluss A: Einnahmen/Steueränderung", () => {
  test("führt eine Steueränderung ohne Modellverwaltung durch und behält den Zustand nach Neuladen", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop-Referenzfluss");

    await page.goto("./#/dashboard");
    const mainNav = page.getByRole("navigation", { name: "Hauptnavigation" });
    await mainNav.getByRole("button", { name: "Einnahmen", exact: true }).click();
    await expect(page).toHaveURL(/#\/einnahmen$/);

    const summary = page.locator(".reform-result-layout");
    await expect(summary.getByText("Was wird geändert?", { exact: true })).toBeVisible();
    const slider = summary.getByLabel("Regelsteuersatz Wert");
    await expect(slider).toBeVisible();

    const kpis = summary.getByTestId("reform-kpi-grid");
    await expect(kpis.locator("article")).toHaveCount(4);
    await expect(summary.getByText("Direkte staatliche Wirkung", { exact: true })).toBeVisible();
    await expect(summary.getByText("Am stärksten betroffen", { exact: true })).toBeVisible();
    await expect(summary.getByText("Belastbarkeit", { exact: true })).toBeVisible();

    await slider.fill("21");
    await expect(kpis.getByTestId("revenue-module-value")).toContainText(/\+|−|±/);

    await page.waitForTimeout(900);
    await page.reload();
    await expect(page.getByLabel("Regelsteuersatz Wert")).toHaveValue("21");

    const affectedSection = page.getByTestId("reform-affected-section");
    await openDisclosure(affectedSection);
    await expect(affectedSection.getByText("Private Haushalte", { exact: true })).toBeVisible();

    const followUpSection = page.getByTestId("reform-follow-up-section");
    await openDisclosure(followUpSection);
    await expect(followUpSection.getByText("Mögliche Folgewirkungen", { exact: true }).first()).toBeVisible();
    await expect(followUpSection.getByText("Aufkommensreaktion im Einnahmenmodell", { exact: true })).toBeVisible();

    const evidenceSection = page.getByTestId("reform-evidence-section");
    await openDisclosure(evidenceSection);
    const dialog = page.getByRole("dialog", { name: "Nachweis: Aufkommen der Umsatzsteuer" });
    await evidenceSection.getByRole("button", { name: "Vollständigen Nachweis öffnen" }).click();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("heading", { name: "Originalquellen" })).toBeVisible();
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.screenshot({ path: "test-results/issue-40-flow-a-einnahmen-desktop.png", fullPage: true });
  });

  test("stellt den Einnahmenfluss mobil ohne horizontale Pflichtnavigation bereit", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobiler Referenzfluss");
    const summary = await openRevenueModule(page);
    await expect(summary.getByLabel("Regelsteuersatz Wert")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: "test-results/issue-40-flow-a-einnahmen-mobile.png", fullPage: true });
  });
});

test.describe("Standardfluss B: Bürgergeldänderung", () => {
  test("ändert Bürgergeld, wechselt in den Expertenmodus und setzt die Baseline zurück", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop-Referenzfluss");

    await page.goto("./#/dashboard");
    const mainNav = page.getByRole("navigation", { name: "Hauptnavigation" });
    await mainNav.getByRole("button", { name: "Ausgaben und Leistungen", exact: true }).click();
    await expect(page).toHaveURL(/#\/ausgaben$/);
    await page.locator(".expense-module-list").getByRole("button", { name: /Bürgergeld/ }).click();

    const editor = page.getByTestId("sgb2-editor");
    await expect(editor).toBeVisible();
    const kpis = page.getByTestId("sgb2-standard-result-kpis");
    await expect(kpis).toBeVisible({ timeout: 120_000 });
    await expect(kpis.locator("article")).toHaveCount(4);

    await page.getByLabel("Regelbedarfe Veränderung in Prozent").fill("5");
    await page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen").fill("120");
    await expect(kpis).toContainText(/\+|−|±/, { timeout: 120_000 });
    await expect(kpis.getByText("Betroffene Menschen", { exact: true })).toBeVisible();
    await expect(kpis.getByText("Durchschnitt pro Bezugsmonat", { exact: true })).toBeVisible();
    await expect(kpis.getByText("Belastbarkeit", { exact: true })).toBeVisible();

    await page.waitForTimeout(900);
    await page.reload();
    await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toHaveValue("5");
    await expect(page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen")).toHaveValue("120");

    await page.getByRole("button", { name: "Experte" }).click();
    await expect(page.getByLabel("Grundabsetzbetrag Erwerbseinkommen Wert")).toHaveValue("120");
    await page.getByRole("button", { name: "Standard" }).click();
    await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toHaveValue("5");

    const dialog = page.getByRole("dialog", { name: "Nachweis: Ausgaben für Bürgergeld und Unterkunft" });
    await page.getByRole("button", { name: "Berechnung und Quellen", exact: true }).first().click();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("heading", { name: "Verwendete Parameter" })).toBeVisible();
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Alle Änderungen zurücksetzen" }).click();
    await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toHaveValue("0");
    await expect(page.getByLabel("Anrechnungsfreier Grundbetrag aus Erwerbseinkommen")).toHaveValue("100");

    await page.screenshot({ path: "test-results/issue-40-flow-b-buergergeld-desktop.png", fullPage: true });
  });

  test("stellt den Bürgergeldfluss mobil ohne horizontale Pflichtnavigation bereit", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobiler Referenzfluss");
    await openBuergergeld(page);
    await expect(page.getByLabel("Regelbedarfe Veränderung in Prozent")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: "test-results/issue-40-flow-b-buergergeld-mobile.png", fullPage: true });
  });
});

test.describe("Standardfluss C: Erweiterte Prüfung ohne Zustandsverlust", () => {
  test("erreicht Modellbasis und Wirkungsregister über Nachweise und kehrt ohne Zustandsverlust zurück", async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Desktop-Referenzfluss");
    testInfo.setTimeout(150_000);

    const summary = await openRevenueModule(page);
    await summary.getByLabel("Regelsteuersatz Wert").fill("22");
    await page.waitForTimeout(900);

    const mainNav = page.getByRole("navigation", { name: "Hauptnavigation" });
    await mainNav.getByRole("button", { name: "Nachweise", exact: true }).click();
    await expect(page).toHaveURL(/#\/transparenz$/);
    await expect(page.getByRole("heading", { name: "Modellbasis und erweiterte Prüfung" })).toBeVisible();

    await page.getByRole("button", { name: /Bevölkerungslauf und Modellbasis/ }).click();
    await expect(page).toHaveURL(/#\/bevoelkerung$/);
    await expect(page.getByRole("heading", { name: "Modellbasis und Bevölkerung" })).toBeVisible({ timeout: 45_000 });

    await page.goto("./#/transparenz");
    await page.getByRole("button", { name: /Wirkungsregister/ }).click();
    await expect(page).toHaveURL(/#\/wirkungen$/);
    await expect(page.getByRole("heading", { name: "Indirekte und langfristige Wirkungen" })).toBeVisible({ timeout: 90_000 });

    await page.goto("./#/einnahmen");
    await expect(page.getByLabel("Regelsteuersatz Wert")).toHaveValue("22");
  });
});

test.describe("Komplexitätsbudget: keine technischen Kennungen im Standardfluss", () => {
  test("zeigt im Einnahmenstandardfluss keine Seeds, Lauf-IDs oder Modellversionen vor dem Öffnen eines Nachweises", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop-Referenzfluss");
    const summary = await openRevenueModule(page);
    await expect(summary).not.toContainText(TECHNICAL_ID_PATTERN);

    const followUpSection = page.getByTestId("reform-follow-up-section");
    await openDisclosure(followUpSection);
    await expect(followUpSection).not.toContainText(TECHNICAL_ID_PATTERN);
  });

  test("zeigt im Bürgergeld-Standardmodus keine Seeds, Lauf-IDs oder Modellversionen", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop-Referenzfluss");
    await openBuergergeld(page);
    const editor = page.getByTestId("sgb2-editor");
    await expect(editor).not.toContainText(TECHNICAL_ID_PATTERN);
  });

  test("führt die Hauptnavigation ohne technische Recheninfrastruktur als gleichrangige Aufgabe", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop-Referenzfluss");
    await page.goto("./#/dashboard");
    const mainNav = page.getByRole("navigation", { name: "Hauptnavigation" });
    for (const removedLabel of ["Dashboard", "Bevölkerung", "Einkommensteuer", "Weitere Einnahmen", "Ausgaben", "Transparenz", "Wirkungen"]) {
      await expect(mainNav.getByRole("button", { name: removedLabel, exact: true })).toHaveCount(0);
    }
  });
});
