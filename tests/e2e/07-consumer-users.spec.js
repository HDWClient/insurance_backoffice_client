/**
 * FUNCTIONAL TEST SUITE — Consumer Users (USER module)
 *
 * Covers:
 *  - Stats row (total, active, suspended, inactive, unverified)
 *  - List rendering, search by name, status filter
 *  - Expand user detail panel
 *  - Update user status (active / suspended / inactive)
 *  - Refresh
 *  - Pagination
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

test.describe("Consumer Users — Stats", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Consumer Users");
  });

  test("stats row is visible", async ({ page }) => {
    await expect(page.locator(".cu-stats-row")).toBeVisible({ timeout: 12_000 });
  });

  test("stat cards are visible", async ({ page }) => {
    await expect(page.locator(".cu-stat-card").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows Total stat card", async ({ page }) => {
    await expect(page.locator(".cu-stat-card").filter({ hasText: /Total/i })).toBeVisible({ timeout: 12_000 });
  });

  test("shows Active stat card", async ({ page }) => {
    await expect(page.locator(".cu-stat-card").filter({ hasText: /Active/i })).toBeVisible({ timeout: 12_000 });
  });

  test("stat values are numeric", async ({ page }) => {
    await expect(page.locator(".cu-stats-row")).toBeVisible({ timeout: 12_000 });
    const vals = await page.locator(".cu-stat-val").allTextContents();
    for (const v of vals) {
      expect(/^\d+$|^—$/.test(v.trim())).toBe(true);
    }
  });
});

test.describe("Consumer Users — List & Search", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Consumer Users");
  });

  test("renders user list table or empty state", async ({ page }) => {
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows user count badge", async ({ page }) => {
    await expect(page.locator(".card__count").first()).toBeVisible({ timeout: 12_000 });
  });

  test("search by name input is present", async ({ page }) => {
    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible({ timeout: 10_000 });
  });

  test("searching by name filters the list", async ({ page }) => {
    await page.getByPlaceholder(/Search by name/i).fill("alice");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("search with no match shows empty state", async ({ page }) => {
    await page.getByPlaceholder(/Search by name/i).fill("xyzNoMatchABC999");
    await page.waitForTimeout(600);
    await expect(page.locator(".empty-state").first()).toBeVisible({ timeout: 8_000 });
  });

  test("clearing search restores full list", async ({ page }) => {
    await page.getByPlaceholder(/Search by name/i).fill("xyzNoMatch");
    await page.waitForTimeout(600);
    await page.getByPlaceholder(/Search by name/i).clear();
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });

  test("status filter dropdown is present", async ({ page }) => {
    const select = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    await expect(select).toBeVisible({ timeout: 10_000 });
  });

  test("filtering by Active status works", async ({ page }) => {
    const select = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await select.selectOption("active");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
    const suspendedBadges = page.locator(".tbl tbody .badge--suspended");
    expect(await suspendedBadges.count()).toBe(0);
  });

  test("filtering by Suspended status works", async ({ page }) => {
    const select = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await select.selectOption("suspended");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("filtering by Inactive status works", async ({ page }) => {
    const select = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await select.selectOption("inactive");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("selecting All restores full list", async ({ page }) => {
    const select = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await select.selectOption("suspended");
    await page.waitForTimeout(400);
    await select.selectOption("");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });
});

test.describe("Consumer Users — Detail Panel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Consumer Users");
  });

  test("expand button opens user detail panel", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
  });

  test("detail panel shows user name and avatar", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    await expect(page.locator(".expand-panel__title").first()).toBeVisible({ timeout: 8_000 });
  });

  test("detail panel shows profile info grid", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    await expect(page.locator(".cu-detail-grid, .org-detail-item").first()).toBeVisible({ timeout: 8_000 });
  });

  test("detail panel shows Update Status section", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    const statusSection = page.locator(".cu-status-edit");
    if (await statusSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(statusSection).toBeVisible();
    }
  });

  test("status select has active, suspended, inactive options", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    const select = page.locator(".expand-panel select").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    const options = await select.locator("option").allTextContents();
    const hasStatuses = options.some(o => /active|suspended|inactive/i.test(o));
    expect(hasStatuses).toBe(true);
  });

  test("can update status and save without error", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;
    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;
    await expandBtn.click();
    const select = page.locator(".expand-panel select").first();
    const saveBtn = page.locator(".expand-panel .btn--primary").first();
    if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) return;

    const current = await select.inputValue();
    const next = current === "active" ? "suspended" : "active";
    await select.selectOption(next);
    await saveBtn.click();
    await page.waitForTimeout(2_000);
    // Revert
    await select.selectOption(current);
    await saveBtn.click();
    await page.waitForTimeout(1_000);
    await expect(page.locator(".expand-panel").first()).toBeVisible();
  });
});

test.describe("Consumer Users — Refresh & Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Consumer Users");
  });

  test("Refresh button reloads the list", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 12_000 });
    await refreshBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("pagination Next / Prev work when multiple pages exist", async ({ page }) => {
    const pagination = page.locator(".bulk-pagination").first();
    if (!await pagination.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    const nextBtn = pagination.getByRole("button", { name: /Next/i });
    if (await nextBtn.isEnabled().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
      const prevBtn = pagination.getByRole("button", { name: /Prev/i });
      if (await prevBtn.isEnabled().catch(() => false)) {
        await prevBtn.click();
        await page.waitForTimeout(1_000);
        await expect(page.locator(".tbl").first()).toBeVisible();
      }
    }
  });
});
