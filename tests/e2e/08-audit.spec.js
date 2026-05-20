/**
 * FUNCTIONAL TEST SUITE — Audit Log (AUDIT module)
 *
 * Covers:
 *  - Layout (filter bar, table, refresh)
 *  - Filter by Module (ORG, CMS_USER, ROLE, BULK, USER)
 *  - Filter by Action (CREATE, UPDATE, DELETE, LOGIN, etc.)
 *  - Filter by date range (From / To)
 *  - Apply Filters → results update
 *  - Clear Filters → resets all
 *  - Pagination (Next, Prev, First, Last)
 *  - Log entries (actor avatar, module badge, action badge)
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

test.describe("Audit Log — Layout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Audit Log");
  });

  test("renders audit log table or empty state", async ({ page }) => {
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows Refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible({ timeout: 10_000 });
  });

  test("shows Module filter select", async ({ page }) => {
    await expect(page.getByLabel("Module")).toBeVisible({ timeout: 10_000 });
  });

  test("shows Action filter select", async ({ page }) => {
    await expect(page.getByLabel("Action")).toBeVisible({ timeout: 10_000 });
  });

  test("shows From date input", async ({ page }) => {
    await expect(page.getByLabel("From")).toBeVisible({ timeout: 10_000 });
  });

  test("shows To date input", async ({ page }) => {
    await expect(page.getByLabel("To")).toBeVisible({ timeout: 10_000 });
  });

  test("shows Apply Filters button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Apply Filters/i })).toBeVisible({ timeout: 10_000 });
  });

  test("shows Clear Filters button", async ({ page }) => {
    const clearBtn = page.getByRole("button", { name: /Clear/i });
    await expect(clearBtn).toBeVisible({ timeout: 10_000 });
  });

  test("table has column headers", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasTable) return;
    const headers = page.locator(".tbl thead th");
    expect(await headers.count()).toBeGreaterThan(0);
  });
});

test.describe("Audit Log — Filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Audit Log");
    await expect(page.getByLabel("Module")).toBeVisible({ timeout: 12_000 });
  });

  test("Module dropdown has options beyond All", async ({ page }) => {
    const select = page.getByLabel("Module");
    const options = await select.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
  });

  test("Action dropdown has options beyond All", async ({ page }) => {
    const select = page.getByLabel("Action");
    const options = await select.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
  });

  test("filter by ORG module and apply", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ORG");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by CMS_USER module and apply", async ({ page }) => {
    await page.getByLabel("Module").selectOption("CMS_USER");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by ROLE module and apply", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ROLE");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by BULK module and apply", async ({ page }) => {
    await page.getByLabel("Module").selectOption("BULK");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by LOGIN action and apply", async ({ page }) => {
    await page.getByLabel("Action").selectOption("LOGIN");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by CREATE action and apply", async ({ page }) => {
    await page.getByLabel("Action").selectOption("CREATE");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("filter by DELETE action and apply", async ({ page }) => {
    await page.getByLabel("Action").selectOption("DELETE");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("apply date range filter (full year)", async ({ page }) => {
    await page.getByLabel("From").fill("2026-01-01");
    await page.getByLabel("To").fill("2026-12-31");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("apply combined module + action filter", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ORG");
    await page.getByLabel("Action").selectOption("CREATE");
    await page.getByRole("button", { name: /Apply Filters/i }).click();
    await page.waitForTimeout(2_000);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });

  test("Clear Filters resets module, action and dates", async ({ page }) => {
    await page.getByLabel("Module").selectOption("ORG");
    await page.getByLabel("Action").selectOption("CREATE");
    await page.getByLabel("From").fill("2026-05-01");
    await page.getByLabel("To").fill("2026-05-31");

    await page.getByRole("button", { name: /Clear/i }).click();
    await expect(page.getByLabel("Module")).toHaveValue("", { timeout: 5_000 });
    await expect(page.getByLabel("Action")).toHaveValue("");
    await expect(page.getByLabel("From")).toHaveValue("");
    await expect(page.getByLabel("To")).toHaveValue("");
  });

  test("Refresh button reloads audit log", async ({ page }) => {
    await page.getByRole("button", { name: /Refresh/i }).click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 12_000 });
  });
});

test.describe("Audit Log — Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Audit Log");
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Next page button loads the next page", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /^Next/ });
    if (!await nextBtn.isEnabled().catch(() => false)) return;
    await nextBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });

  test("Prev page button goes back a page", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /^Next/ });
    if (!await nextBtn.isEnabled().catch(() => false)) return;
    await nextBtn.click();
    await page.waitForTimeout(1_500);
    const prevBtn = page.getByRole("button", { name: /^Prev/ });
    if (!await prevBtn.isEnabled().catch(() => false)) return;
    await prevBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl").first()).toBeVisible();
  });

  test("Last page button jumps to final page and disables itself", async ({ page }) => {
    const lastBtn = page.getByRole("button", { name: /Last/ });
    if (!await lastBtn.isEnabled().catch(() => false)) return;
    await lastBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    await expect(lastBtn).toBeDisabled();
  });

  test("First page button returns to page 1 and disables itself", async ({ page }) => {
    const lastBtn = page.getByRole("button", { name: /Last/ });
    if (!await lastBtn.isEnabled().catch(() => false)) return;
    await lastBtn.click();
    await page.waitForTimeout(1_500);
    const firstBtn = page.getByRole("button", { name: /First/ });
    if (!await firstBtn.isEnabled().catch(() => false)) return;
    await firstBtn.click();
    await page.waitForTimeout(1_500);
    await expect(page.locator(".tbl").first()).toBeVisible();
    await expect(firstBtn).toBeDisabled();
  });

  test("page indicator text updates after navigation", async ({ page }) => {
    const indicator = page.locator(".tbl__muted").filter({ hasText: /Page \d+ of \d+/ });
    if (!await indicator.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    const before = await indicator.innerText();
    const nextBtn = page.getByRole("button", { name: /^Next/ });
    if (!await nextBtn.isEnabled().catch(() => false)) return;
    await nextBtn.click();
    await page.waitForTimeout(1_500);
    const after = await indicator.innerText();
    expect(before).not.toEqual(after);
  });
});

test.describe("Audit Log — Log Entry Content", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Audit Log");
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible({ timeout: 15_000 });
  });

  test("log entries show timestamp column", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible().catch(() => false);
    if (!hasTable) return;
    const firstRow = page.locator(".tbl tbody tr").first();
    await expect(firstRow).toBeVisible();
  });

  test("log entries show action badges", async ({ page }) => {
    const hasTable = await page.locator(".tbl").isVisible().catch(() => false);
    if (!hasTable) return;
    const badges = page.locator(".action-badge");
    if (await badges.count() > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });
});
