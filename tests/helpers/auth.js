import { expect } from "@playwright/test";

export const SUPER_ADMIN = {
  email: "root@kinko.local",
  password: "Admin@123",
};

/**
 * Logs in as the super-admin and waits for the dashboard to render.
 */
export async function loginAsSuperAdmin(page) {
  await page.goto("/#/admin/login");
  await page.locator("#email").fill(SUPER_ADMIN.email);
  await page.locator("#password").fill(SUPER_ADMIN.password);
  await page.locator(".sa-login-form__submit").click();
  await expect(page).toHaveURL(/#\/admin\/dashboard/, { timeout: 15_000 });
  await page.locator(".sa-overview__title").waitFor({ timeout: 10_000 });
}

/**
 * Navigates to a module tab by clicking its tile on the overview,
 * or by clicking the nav pill if already in the detail view.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label - e.g. "Organizations", "Manage Users", "Operations"
 */
export async function navigateToModule(page, label) {
  const navPill = page.locator(".sa-nav-pill").filter({ hasText: label });
  const inDetailView = await navPill.isVisible().catch(() => false);

  if (inDetailView) {
    await navPill.click();
  } else {
    await page.locator(".sa-tile").filter({ hasText: label }).click();
  }
  await page.locator(".tab-content").first().waitFor({ timeout: 10_000 });
}
