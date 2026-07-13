import { expect, test } from "@playwright/test";

test("zeigt HaushaltsKompass-Branding und speichert den Darkmode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("haushaltskompass-theme", "light"));
  await page.goto("./#/dashboard");

  await expect(page).toHaveTitle("HaushaltsKompass");
  await expect(page.locator(".brand-logo")).toBeVisible();
  await expect(page.locator(".brand-copy strong")).toHaveText("HaushaltsKompass");

  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toMatch(/^data:image\/png;base64,/);

  const themeToggle = page.getByRole("button", { name: "Dunklen Modus aktivieren" });
  await themeToggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Hellen Modus aktivieren" })).toBeVisible();

  await test.info().attach("haushaltskompass-darkmode", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
