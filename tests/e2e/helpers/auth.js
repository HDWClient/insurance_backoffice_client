import { expect } from "@playwright/test";

export const SUPER_ADMIN = { email: "root@kinko.local", password: "Admin@123" };

/** Log in as super-admin and wait for the dashboard overview to be ready. */
export async function loginAsSuperAdmin(page) {
  await page.goto("/#/admin/login");
  await page.locator("#email").fill(SUPER_ADMIN.email);
  await page.locator("#password").fill(SUPER_ADMIN.password);
  await page.locator(".sa-login-form__submit").click();
  await expect(page).toHaveURL(/#\/admin\/dashboard/, { timeout: 20_000 });
  await expect(page.locator(".sa-overview__title")).toBeVisible({ timeout: 15_000 });
}

/**
 * Navigate to a named module tab.
 * Handles both overview (clicks tile) and detail view (clicks nav pill).
 */
export async function goToModule(page, label) {
  const pill = page.locator(".sa-nav-pill").filter({ hasText: label });
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
  } else {
    await page.locator(".sa-tile").filter({ hasText: label }).click();
  }
  await expect(page.locator(".tab-content").first()).toBeVisible({ timeout: 12_000 });
}
