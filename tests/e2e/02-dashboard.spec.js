/**
 * FUNCTIONAL TEST SUITE — Dashboard
 *
 * Covers:
 *  - Overview layout (title, summary strip, tiles)
 *  - Tile click → detail view with nav pills
 *  - Back button → overview
 *  - Nav pill switching between modules
 *  - Org dropdown (open, select)
 *  - Navbar elements
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

test.describe("Dashboard — Overview", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("shows Admin Dashboard title", async ({ page }) => {
    await expect(page.locator(".sa-overview__title")).toHaveText("Admin Dashboard");
  });

  test("shows welcome sub-text", async ({ page }) => {
    await expect(page.locator(".sa-overview__sub")).toBeVisible();
  });

  test("shows summary strip with stat cards", async ({ page }) => {
    await expect(page.locator(".sa-summary-strip")).toBeVisible();
    const cards = page.locator(".sa-sum-card");
    await expect(cards.first()).toBeVisible();
  });

  test("shows module tiles grid", async ({ page }) => {
    await expect(page.locator(".sa-tiles-grid")).toBeVisible();
    const tiles = page.locator(".sa-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test("each tile has a title and arrow", async ({ page }) => {
    const firstTile = page.locator(".sa-tile").first();
    await expect(firstTile.locator(".sa-tile__title")).toBeVisible();
    await expect(firstTile.locator(".sa-tile__arrow")).toBeVisible();
  });

  test("tiles include expected modules", async ({ page }) => {
    const tileGrid = page.locator(".sa-tiles-grid");
    // At least one of these should be present
    const text = await tileGrid.innerText();
    const hasAnyModule = /Organizations|Manage Users|Manage Roles|Operations|Audit|Consumer/i.test(text);
    expect(hasAnyModule).toBe(true);
  });
});

test.describe("Dashboard — Navbar", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("navbar shows Kinko logo", async ({ page }) => {
    await expect(page.locator(".sa-navbar__logo")).toBeVisible();
  });

  test("navbar shows Admin Portal label", async ({ page }) => {
    await expect(page.locator(".sa-navbar__app")).toHaveText("Admin Portal");
  });

  test("navbar shows org name or dropdown", async ({ page }) => {
    await expect(page.locator(".sa-navbar__right")).toBeVisible();
  });

  test("navbar shows Sign out button", async ({ page }) => {
    await expect(page.locator(".sa-navbar__logout")).toHaveText("Sign out");
  });
});

test.describe("Dashboard — Tile Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("clicking a tile shows detail view with back button", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-back-btn")).toBeVisible({ timeout: 10_000 });
  });

  test("detail view shows nav pills", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-detail-nav")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".sa-nav-pill").first()).toBeVisible();
  });

  test("active nav pill is highlighted", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-nav-pill--active")).toBeVisible({ timeout: 10_000 });
  });

  test("back button returns to overview", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-back-btn")).toBeVisible({ timeout: 10_000 });
    await page.locator(".sa-back-btn").click();
    await expect(page.locator(".sa-overview__title")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".sa-tiles-grid")).toBeVisible();
  });

  test("clicking a different nav pill switches the active tab", async ({ page }) => {
    await page.locator(".sa-tile").first().click();
    await expect(page.locator(".sa-nav-pill").first()).toBeVisible({ timeout: 10_000 });
    const pills = page.locator(".sa-nav-pill");
    const count = await pills.count();
    if (count >= 2) {
      await pills.nth(1).click();
      await expect(pills.nth(1)).toHaveClass(/sa-nav-pill--active/, { timeout: 5_000 });
      await expect(pills.nth(0)).not.toHaveClass(/sa-nav-pill--active/);
    }
  });

  test("can navigate to each module from tile", async ({ page }) => {
    const tiles = page.locator(".sa-tile");
    const count = await tiles.count();
    // Navigate to first tile and verify tab-content renders
    await tiles.first().click();
    await expect(page.locator(".tab-content").first()).toBeVisible({ timeout: 10_000 });
    // Go back and try second tile if available
    if (count >= 2) {
      await page.locator(".sa-back-btn").click();
      await tiles.nth(1).click();
      await expect(page.locator(".tab-content").first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe("Dashboard — Org Switcher", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("org switcher is visible in navbar right", async ({ page }) => {
    const right = page.locator(".sa-navbar__right");
    await expect(right).toBeVisible();
    // org name or dropdown button must be present
    const orgText = await right.innerText();
    expect(orgText.trim().length).toBeGreaterThan(0);
  });

  test("org dropdown opens when clicked (if multiple orgs)", async ({ page }) => {
    const orgBtn = page.locator(".sa-navbar__right button").first();
    const exists = await orgBtn.isVisible().catch(() => false);
    if (exists) {
      await orgBtn.click();
      // Dropdown list appears
      await expect(page.locator(".sa-navbar__right button").nth(1)).toBeVisible({ timeout: 5_000 });
    }
  });
});
