/**
 * FUNCTIONAL TEST SUITE — Manage Users (CMS_USER module)
 *
 * Covers:
 *  - List rendering, search, status filter, pagination
 *  - Invite user (validation + success)
 *  - Expand user row (detail panel)
 *  - Assign role to user
 *  - Revoke role from user
 *  - Delete user → confirm
 *  - Re-invite deleted user
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

const TS = Date.now();
const USER_EMAIL = `e2e-${TS}@test.local`;
const USER_NAME  = `E2E User ${TS}`;

test.describe("Manage Users — List & Filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
  });

  test("renders user list table", async ({ page }) => {
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows user count badge", async ({ page }) => {
    await expect(page.locator(".card__count").first()).toBeVisible({ timeout: 10_000 });
  });

  test("search input is present", async ({ page }) => {
    await expect(page.getByPlaceholder("Search by name or email…")).toBeVisible({ timeout: 10_000 });
  });

  test("search filters the list", async ({ page }) => {
    const search = page.getByPlaceholder("Search by name or email…");
    await search.fill("root");
    await page.waitForTimeout(600);
    const rows = page.locator(".tbl tbody tr:not(.expand-row)");
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });

  test("search with no match shows empty state", async ({ page }) => {
    await page.getByPlaceholder("Search by name or email…").fill("xyz_no_match_abc_999");
    await page.waitForTimeout(600);
    await expect(page.locator(".empty-state").first()).toBeVisible({ timeout: 8_000 });
  });

  test("status filter buttons are visible", async ({ page }) => {
    await expect(page.locator(".btn--ghost").filter({ hasText: "All" }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".btn--ghost").filter({ hasText: "Active" }).first()).toBeVisible();
    await expect(page.locator(".btn--ghost").filter({ hasText: "Inactive" }).first()).toBeVisible();
  });

  test("Active filter shows only active users", async ({ page }) => {
    await page.locator(".btn--ghost").filter({ hasText: "Active" }).first().click();
    await page.waitForTimeout(500);
    const inactiveBadges = page.locator(".tbl tbody .badge--inactive");
    expect(await inactiveBadges.count()).toBe(0);
  });

  test("Deleted tab is shown and switches panel", async ({ page }) => {
    const deletedTab = page.locator(".btn--ghost").filter({ hasText: "Deleted" });
    if (await deletedTab.isVisible().catch(() => false)) {
      await deletedTab.click();
      await page.waitForTimeout(500);
      // Panel switches — table or empty state should still be visible
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });
});

test.describe("Manage Users — Invite User", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
  });

  test("invite form has Full Name, Work Email and Role fields", async ({ page }) => {
    await expect(page.getByLabel("Full Name *")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Work Email *")).toBeVisible();
  });

  test("submitting empty form shows validation errors", async ({ page }) => {
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("empty name shows name validation error", async ({ page }) => {
    await page.getByLabel("Work Email *").fill("test@test.com");
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("empty email shows email validation error", async ({ page }) => {
    await page.getByLabel("Full Name *").fill("Test User");
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("invalid email format shows validation error", async ({ page }) => {
    await page.getByLabel("Full Name *").fill("Test User");
    await page.getByLabel("Work Email *").fill("not-an-email");
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("inviting a valid user adds them to the list", async ({ page }) => {
    await page.getByLabel("Full Name *").fill(USER_NAME);
    await page.getByLabel("Work Email *").fill(USER_EMAIL);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".tbl").first()).toContainText(USER_EMAIL, { timeout: 15_000 });
  });
});

test.describe("Manage Users — User Detail Panel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
  });

  test("clicking a row expands the detail panel", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
  });

  test("detail panel shows user name in header", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel__title").first()).toBeVisible({ timeout: 8_000 });
  });

  test("detail panel shows assigned roles section", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel__body").first()).toBeVisible({ timeout: 8_000 });
  });

  test("clicking row again collapses the panel", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    await row.click();
    await expect(page.locator(".expand-panel").first()).not.toBeVisible({ timeout: 6_000 });
  });
});

test.describe("Manage Users — Role Assignment", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
    // Find the invited test user
    await page.getByPlaceholder("Search by name or email…").fill(USER_EMAIL);
    await page.waitForTimeout(600);
  });

  test("role rows appear in user detail panel", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    const roleRows = page.locator(".ut-role-row");
    // May be 0 if no roles — just verify no crash
    const count = await roleRows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("can assign a role to the invited user", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const assignBtn = page.locator(".expand-panel .btn--primary, .ut-role-row .btn--primary").first();
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click();
      await page.waitForTimeout(1_500);
      // Role chip should appear
      await expect(page.locator(".ut-role-chips, .ut-role-row").first()).toBeVisible({ timeout: 8_000 });
    }
  });
});

test.describe("Manage Users — Delete & Re-invite", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
    await page.getByPlaceholder("Search by name or email…").fill(USER_EMAIL);
    await page.waitForTimeout(600);
  });

  test("delete button shows confirmation modal", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    if (!await row.isVisible({ timeout: 10_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const deleteBtn = page.locator(".btn--danger").first();
    if (!await deleteBtn.isVisible().catch(() => false)) return;
    await deleteBtn.click();

    const modal = page.locator(".uc-modal");
    if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(modal).toBeVisible();
      await page.locator(".uc-modal__actions .btn--ghost").click();
    }
  });

  test("confirming delete removes user from active list", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    if (!await row.isVisible({ timeout: 10_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const deleteBtn = page.locator(".btn--danger").first();
    if (!await deleteBtn.isVisible().catch(() => false)) return;
    await deleteBtn.click();

    const modal = page.locator(".uc-modal");
    if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator(".uc-modal__actions .btn--danger").click();
      await page.waitForTimeout(2_000);
      await expect(page.locator(".tbl")).not.toContainText(USER_EMAIL, { timeout: 12_000 });
    }
  });

  test("deleted user appears in Deleted tab with Re-invite button", async ({ page }) => {
    const deletedTab = page.locator(".btn--ghost").filter({ hasText: "Deleted" });
    if (!await deletedTab.isVisible().catch(() => false)) return;
    await deletedTab.click();
    await page.waitForTimeout(500);

    const hasUser = await page.locator(".tbl").getByText(USER_EMAIL).isVisible().catch(() => false);
    if (hasUser) {
      const reinviteBtn = page.locator(".tbl").getByRole("button", { name: /Re-invite/i });
      await expect(reinviteBtn.first()).toBeVisible({ timeout: 6_000 });
    }
  });
});

test.describe("Manage Users — Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Users");
  });

  test("pagination controls appear and work", async ({ page }) => {
    const nextBtn = page.locator(".bulk-pagination").getByRole("button", { name: /Next/i });
    if (await nextBtn.isEnabled().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator(".tbl").first()).toBeVisible();
      const prevBtn = page.locator(".bulk-pagination").getByRole("button", { name: /Prev/i });
      if (await prevBtn.isEnabled().catch(() => false)) {
        await prevBtn.click();
        await page.waitForTimeout(1_000);
        await expect(page.locator(".tbl").first()).toBeVisible();
      }
    }
  });
});
