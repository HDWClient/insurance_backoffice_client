import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "../helpers/auth.js";

test.describe("Super Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  // ── Overview ────────────────────────────────────────────────

  test("shows Admin Dashboard title on overview", async ({ page }) => {
    await expect(page.locator(".sa-overview__title")).toHaveText("Admin Dashboard");
  });

  test("renders module tiles on overview", async ({ page }) => {
    const grid = page.locator(".sa-tiles-grid");
    await expect(grid).toBeVisible();
    await expect(page.locator(".sa-tile").first()).toBeVisible();
  });

  test("shows summary strip with stat cards", async ({ page }) => {
    await expect(page.locator(".sa-summary-strip")).toBeVisible();
    await expect(page.locator(".sa-sum-card").first()).toBeVisible();
  });

  test("shows navbar with Admin Portal label", async ({ page }) => {
    await expect(page.locator(".sa-navbar")).toBeVisible();
    await expect(page.locator(".sa-navbar__app")).toHaveText("Admin Portal");
  });

  test("shows org dropdown in navbar", async ({ page }) => {
    await expect(page.locator(".sa-navbar__right")).toBeVisible();
  });

  test("shows sign out button", async ({ page }) => {
    await expect(page.locator(".sa-navbar__logout")).toHaveText("Sign out");
  });

  // ── Tile navigation ─────────────────────────────────────────

  test("clicking a tile enters detail view", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-back-btn")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".sa-detail-nav")).toBeVisible();
  });

  test("back button returns to overview", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-back-btn")).toBeVisible({ timeout: 8_000 });
    await page.locator(".sa-back-btn").click();
    await expect(page.locator(".sa-overview__title")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".sa-tiles-grid")).toBeVisible();
  });

  test("nav pills appear in detail view for all loaded modules", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-nav-pill").first()).toBeVisible({ timeout: 8_000 });
    const count = await page.locator(".sa-nav-pill").count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking nav pills switches active tab", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-nav-pill").first()).toBeVisible({ timeout: 8_000 });

    const pills = page.locator(".sa-nav-pill");
    const count = await pills.count();
    if (count > 1) {
      await pills.nth(1).click();
      await expect(pills.nth(1)).toHaveClass(/sa-nav-pill--active/);
    }
  });

  // ── Org dropdown ────────────────────────────────────────────

  test("org dropdown opens and lists orgs when clicked", async ({ page }) => {
    const orgBtn = page.locator(".sa-navbar__right button").first();
    const isVisible = await orgBtn.isVisible().catch(() => false);
    if (isVisible) {
      await orgBtn.click();
      // The dropdown lists org buttons
      const orgItems = page.locator(".sa-navbar__right button").filter({ hasText: /\S/ });
      await expect(orgItems.first()).toBeVisible({ timeout: 5_000 });
    }
    // If only one org, the dropdown is replaced by a static label — no action needed
  });

  // ── Sign out ────────────────────────────────────────────────

  test("sign out redirects to admin login", async ({ page }) => {
    await page.locator(".sa-navbar__logout").click();
    await expect(page).toHaveURL(/#\/admin\/login/, { timeout: 10_000 });
  });
});
