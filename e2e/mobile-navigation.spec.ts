import { expect, test } from "@playwright/test";

const navigationLabels = [
  "Dashboard",
  "Bevölkerung",
  "Einkommensteuer",
  "Weitere Einnahmen",
  "Ausgaben",
  "Wirkungen",
  "Vergleich",
  "Transparenz",
];

test.describe.configure({ timeout: 90_000 });

test("stellt die Desktop-Navigation mobil als bedienbares Burger-Menü bereit", async ({ page, isMobile }) => {
  await page.goto("/de-sim/#/dashboard");
  await expect(page.getByRole("button", { name: "Zum HaushaltsKompass-Dashboard" })).toBeVisible({ timeout: 45_000 });

  const menuButton = page.getByRole("button", { name: "Hauptmenü öffnen" });
  if (!isMobile) {
    await expect(menuButton).toBeHidden();
    return;
  }

  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();

  const menu = page.getByRole("dialog", { name: "Hauptmenü" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("button", { name: "Hauptmenü schließen" }).first()).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  for (const label of navigationLabels) {
    await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(menu.getByRole("button", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");

  await menu.getByRole("button", { name: "Wirkungen", exact: true }).click();
  await expect(page).toHaveURL(/#\/wirkungen$/);
  await expect(menu).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  const effectsMenuButton = page.getByRole("button", { name: "Hauptmenü öffnen" });
  await expect(effectsMenuButton).toBeVisible({ timeout: 45_000 });
  await effectsMenuButton.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Wirkungen", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Hauptmenü öffnen" })).toBeFocused();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
