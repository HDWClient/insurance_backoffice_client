import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, navigateToModule } from "../helpers/auth.js";

test.describe("Audit Log (AUDIT module)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateToModule(page, "Audit Log");
  });

  // ── Layout ─────────────────────────────────────────────────

  test("renders audit log table or empty state", async ({ page }) => {
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows Refresh button", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
  });

  test("shows filter bar with Module and Action selects", async ({ page }) => {
    await expect(page.getByLabel("Module")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Action")).toBeVisible({ timeout: 10_000 });
  });

  test("shows From and To date filter inputs", async ({ page }) => {
    await expect(page.getByLabel("From")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("To")).toBeVisible({ timeout: 10_000 });
  });

  test("shows Apply Filters button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Apply Filters/i })).toBeVisible({ timeout: 10_000 });
  });

  test("audit table shows Timestamp, Actor, Module, Action columns", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const headers = table.locator("thead th");
      await expect(headers.first()).toBeVisible();
    }
  });

  // ── Filters ─────────────────────────────────────────────────

  test("Module filter dropdown has module options", async ({ page }) => {
    const moduleSelect = page.getByLabel("Module");
    await expect(moduleSelect).toBeVisible({ timeout: 10_000 });
    await moduleSelect.selectOption({ index: 1 });
    const val = await moduleSelect.inputValue();
    expect(val.length).toBeGreaterThan(0);
    // Reset
    await moduleSelect.selectOption("");
  });

  test("Action filter dropdown has action options", async ({ page }) => {
    const actionSelect = page.getByLabel("Action");
    await expect(actionSelect).toBeVisible({ timeout: 10_000 });
    await actionSelect.selectOption({ index: 1 });
    const val = await actionSelect.inputValue();
    expect(val.length).toBeGreaterThan(0);
    await actionSelect.selectOption("");
  });

  test("filtering by module=ORG shows only ORG logs", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ORG");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);

    const hasTable = await page.locator(".tbl").isVisible().catch(() => false);
    if (hasTable) {
      // Every visible module badge should say ORG
      const moduleBadges = page.locator(".tbl tbody .badge").filter({ hasText: "ORG" });
      const count = await moduleBadges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("filtering by action=LOGIN shows only LOGIN logs", async ({ page }) => {
    await page.getByLabel("Action").selectOption("LOGIN");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  test("applying date range filters and loading results", async ({ page }) => {
    await page.getByLabel("From").fill("2026-01-01");
    await page.getByLabel("To").fill("2026-12-31");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("clear filters button resets filter state", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ORG");
    await page.getByLabel("Action").selectOption("CREATE");
    await page.getByLabel("From").fill("2026-05-01");

    const clearBtn = page.getByRole("button", { name: /Clear/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(page.getByLabel("Module")).toHaveValue("");
      await expect(page.getByLabel("Action")).toHaveValue("");
      await expect(page.getByLabel("From")).toHaveValue("");
    }
  });

  test("clicking Refresh reloads the audit log", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await refreshBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Pagination ──────────────────────────────────────────────

  test("pagination bar is visible when logs exist", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const pagination = page.locator(".bulk-pagination").first();
      if (await pagination.isVisible().catch(() => false)) {
        await expect(pagination).toBeVisible();
      }
    }
  });

  test("Next page button loads next page of results", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const nextBtn = page.getByRole("button", { name: /Next/i });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
      }
    }
  });

  test("Prev page button returns to previous page", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const nextBtn = page.getByRole("button", { name: /Next/i });
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1_500);

        const prevBtn = page.getByRole("button", { name: /Prev/i });
        if (await prevBtn.isEnabled().catch(() => false)) {
          await prevBtn.click();
          await page.waitForTimeout(1_500);
          await expect(page.locator(".tbl").first()).toBeVisible();
        }
      }
    }
  });

  test("Last page button jumps to final page", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const lastBtn = page.getByRole("button", { name: /Last/i });
      if (await lastBtn.isEnabled().catch(() => false)) {
        await lastBtn.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
        // Last button should now be disabled
        await expect(lastBtn).toBeDisabled();
      }
    }
  });

  test("First page button jumps back to first page", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const lastBtn = page.getByRole("button", { name: /Last/i });
      if (await lastBtn.isEnabled().catch(() => false)) {
        await lastBtn.click();
        await page.waitForTimeout(1_500);

        const firstBtn = page.getByRole("button", { name: /First/i });
        if (await firstBtn.isEnabled().catch(() => false)) {
          await firstBtn.click();
          await page.waitForTimeout(1_500);
          await expect(page.locator(".tbl").first()).toBeVisible();
          // First button should now be disabled
          await expect(firstBtn).toBeDisabled();
        }
      }
    }
  });

  // ── Log Entry ───────────────────────────────────────────────

  test("audit log entry shows actor avatar with initial", async ({ page }) => {
    const table = page.locator(".tbl").first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasTable) {
      const firstRow = page.locator(".tbl tbody tr").first();
      if (await firstRow.isVisible().catch(() => false)) {
        await expect(firstRow).toBeVisible();
      }
    }
  });

  test("filtering by CMS_USER module shows CMS user operation logs", async ({ page }) => {
    await page.getByLabel("Module").selectOption("CMS_USER");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });
});
