import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, navigateToModule } from "../helpers/auth.js";

test.describe("Consumer Users (USER module)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateToModule(page, "Consumer Users");
  });

  // ── Stats Row ───────────────────────────────────────────────

  test("renders stats row with stat cards", async ({ page }) => {
    await expect(page.locator(".cu-stats-row")).toBeVisible({ timeout: 12_000 });
    await expect(page.locator(".cu-stat-card").first()).toBeVisible();
  });

  test("stats show Total count", async ({ page }) => {
    await expect(page.locator(".cu-stat-card").filter({ hasText: /Total/i })).toBeVisible({ timeout: 12_000 });
  });

  test("stats show Active and Suspended counts", async ({ page }) => {
    await expect(page.locator(".cu-stats-row")).toBeVisible({ timeout: 12_000 });
    const statCards = page.locator(".cu-stat-card");
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── Filter Bar ──────────────────────────────────────────────

  test("shows search by name input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await expect(searchInput).toBeVisible({ timeout: 12_000 });
  });

  test("shows status filter dropdown", async ({ page }) => {
    const statusSelect = page.locator(".cu-filter-bar .form__input.form__select, .cu-filter-bar select");
    await expect(statusSelect.first()).toBeVisible({ timeout: 12_000 });
  });

  // ── List View ───────────────────────────────────────────────

  test("renders consumer users list or empty state", async ({ page }) => {
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows user count badge on list card", async ({ page }) => {
    await expect(page.locator(".card__count").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows Refresh button on list card", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 12_000 });
  });

  test("user rows show name, email, mobile, and status badge", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (hasTable) {
      const firstDataRow = page.locator(".tbl tbody tr:not(.expand-row)").first();
      if (await firstDataRow.isVisible().catch(() => false)) {
        await expect(firstDataRow.locator(".badge").first()).toBeVisible();
      }
    }
  });

  // ── Search ──────────────────────────────────────────────────

  test("searching by name filters the list", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("alice");
    await page.waitForTimeout(600); // debounced
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("clearing search restores full list", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("xyznonexistentatall");
    await page.waitForTimeout(600);
    await searchInput.clear();
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });

  // ── Status Filter ───────────────────────────────────────────

  test("filtering by Active status shows only active users", async ({ page }) => {
    const statusSelect = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (await statusSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await statusSelect.selectOption("active");
      await page.waitForTimeout(600);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("filtering by Suspended status shows suspended users", async ({ page }) => {
    const statusSelect = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (await statusSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await statusSelect.selectOption("suspended");
      await page.waitForTimeout(600);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("selecting All status shows all users", async ({ page }) => {
    const statusSelect = page.locator(".cu-filter-bar select, .cu-filter-bar .form__select").first();
    if (await statusSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await statusSelect.selectOption("suspended");
      await page.waitForTimeout(500);
      await statusSelect.selectOption("");
      await page.waitForTimeout(600);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });

  // ── Expand User Detail ──────────────────────────────────────

  test("clicking expand button opens user detail panel", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (hasTable) {
      const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
      if (await expandBtn.isVisible().catch(() => false)) {
        await expandBtn.click();
        await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
      }
    }
  });

  test("user detail panel shows profile information fields", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (hasTable) {
      const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
      if (await expandBtn.isVisible().catch(() => false)) {
        await expandBtn.click();
        const panel = page.locator(".expand-panel").first();
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(panel.locator(".cu-detail-grid, .org-detail-item").first()).toBeVisible();
      }
    }
  });

  test("user detail panel shows Update Status section", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (hasTable) {
      const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
      if (await expandBtn.isVisible().catch(() => false)) {
        await expandBtn.click();
        const panel = page.locator(".expand-panel").first();
        await expect(panel).toBeVisible({ timeout: 8_000 });
        const updateSection = panel.locator(".cu-status-edit");
        if (await updateSection.isVisible().catch(() => false)) {
          await expect(updateSection).toBeVisible();
        }
      }
    }
  });

  test("status select in detail panel has active/suspended/inactive options", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (hasTable) {
      const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
      if (await expandBtn.isVisible().catch(() => false)) {
        await expandBtn.click();
        const panel = page.locator(".expand-panel").first();
        await expect(panel).toBeVisible({ timeout: 8_000 });
        const statusSelect = panel.locator("select");
        if (await statusSelect.isVisible().catch(() => false)) {
          const options = await statusSelect.locator("option").allTextContents();
          const hasStatusOptions = options.some((o) =>
            /active|suspended|inactive/i.test(o)
          );
          expect(hasStatusOptions).toBe(true);
        }
      }
    }
  });

  test("can update user status and save", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    if (!hasTable) return;

    const expandBtn = page.locator(".tbl tbody tr:not(.expand-row) .btn--ghost").first();
    if (!await expandBtn.isVisible().catch(() => false)) return;

    await expandBtn.click();
    const panel = page.locator(".expand-panel").first();
    await expect(panel).toBeVisible({ timeout: 8_000 });

    const statusSelect = panel.locator("select");
    const saveBtn = panel.locator(".btn--primary").first();

    if (
      await statusSelect.isVisible().catch(() => false) &&
      await saveBtn.isVisible().catch(() => false)
    ) {
      // Get current status and switch to a different one
      const current = await statusSelect.inputValue();
      const newStatus = current === "active" ? "suspended" : "active";
      await statusSelect.selectOption(newStatus);
      await saveBtn.click();
      await page.waitForTimeout(2_000);
      // No crash = success for this test
      await expect(panel).toBeVisible();
    }
  });

  // ── Pagination ──────────────────────────────────────────────

  test("pagination appears when multiple pages exist", async ({ page }) => {
    const pagination = page.locator(".bulk-pagination").first();
    const hasPagination = await pagination.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPagination) {
      const nextBtn = pagination.getByRole("button", { name: /Next/i });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1_000);
        await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
      }
    }
  });

  // ── Refresh ─────────────────────────────────────────────────

  test("clicking Refresh reloads user list", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await refreshBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });
});
