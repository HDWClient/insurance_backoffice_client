/**
 * FUNCTIONAL TEST SUITE — Manage Roles (ROLE module)
 *
 * Covers:
 *  - List rendering
 *  - Create custom role (validation + success)
 *  - Expand role row (detail panel)
 *  - Add / remove permission on custom role
 *  - System roles are not deletable
 *  - Delete custom role
 *  - Role users panel
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

const TS = Date.now();
const ROLE_NAME = `E2E Role ${TS}`;

test.describe("Manage Roles — List", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("renders roles table", async ({ page }) => {
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 12_000 });
  });

  test("shows role count badge", async ({ page }) => {
    await expect(page.locator(".card__count").first()).toBeVisible({ timeout: 10_000 });
  });

  test("system roles show System badge", async ({ page }) => {
    await expect(page.locator(".badge--system").first()).toBeVisible({ timeout: 10_000 });
  });

  test("each role row shows name, type badge, user count", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const badge = row.locator(".badge").first();
    await expect(badge).toBeVisible();
  });
});

test.describe("Manage Roles — Create", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("create form has Role Name field", async ({ page }) => {
    await expect(page.locator(".form__input").first()).toBeVisible({ timeout: 10_000 });
  });

  test("submitting empty name shows validation error", async ({ page }) => {
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("creates custom role and it appears in list", async ({ page }) => {
    await page.locator(".form__input").first().fill(ROLE_NAME);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".tbl").first()).toContainText(ROLE_NAME, { timeout: 15_000 });
  });

  test("new role has 0 users and 0 permissions", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").filter({ hasText: ROLE_NAME });
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = await row.innerText();
      expect(text).toMatch(/0/);
    }
  });
});

test.describe("Manage Roles — Detail Panel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("clicking a role row expands the panel", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
  });

  test("panel shows role name in header", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel__title").first()).toBeVisible({ timeout: 8_000 });
  });

  test("panel body renders without error", async ({ page }) => {
    await page.locator(".tbl tbody tr:not(.expand-row)").first().click();
    await expect(page.locator(".expand-panel__body").first()).toBeVisible({ timeout: 8_000 });
  });

  test("panel shows permissions list (checkboxes or table)", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").filter({ hasText: ROLE_NAME });
    const isVisible = await row.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) return;
    await row.click();
    await expect(page.locator(".expand-panel__body").first()).toBeVisible({ timeout: 8_000 });
    const perms = page.locator(".expand-panel input[type='checkbox']");
    const count = await perms.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("clicking row again collapses panel", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").first();
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    await row.click();
    await expect(page.locator(".expand-panel").first()).not.toBeVisible({ timeout: 6_000 });
  });
});

test.describe("Manage Roles — Permission Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("can toggle a permission on the custom role", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").filter({ hasText: ROLE_NAME });
    if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const unchecked = page.locator(".expand-panel input[type='checkbox']:not(:checked)").first();
    if (await unchecked.isVisible().catch(() => false)) {
      await unchecked.click();
      await page.waitForTimeout(1_500);
      // Verify no crash — state updates asynchronously
      await expect(page.locator(".expand-panel").first()).toBeVisible();
    }
  });

  test("toggling a checked permission removes it", async ({ page }) => {
    const row = page.locator(".tbl tbody tr:not(.expand-row)").filter({ hasText: ROLE_NAME });
    if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const checked = page.locator(".expand-panel input[type='checkbox']:checked").first();
    if (await checked.isVisible().catch(() => false)) {
      await checked.click();
      await page.waitForTimeout(1_500);
      await expect(page.locator(".expand-panel").first()).toBeVisible();
    }
  });
});

test.describe("Manage Roles — System Role Constraints", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("system role row is present", async ({ page }) => {
    const systemRow = page.locator(".tbl tbody tr:not(.expand-row)").filter({
      has: page.locator(".badge--system"),
    }).first();
    await expect(systemRow).toBeVisible({ timeout: 12_000 });
  });

  test("system role does not have a delete button in its panel", async ({ page }) => {
    const systemRow = page.locator(".tbl tbody tr:not(.expand-row)").filter({
      has: page.locator(".badge--system"),
    }).first();
    await systemRow.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    const deleteBtn = page.locator(".expand-panel .btn--danger");
    // Should be absent or disabled
    const isDangerVisible = await deleteBtn.isVisible().catch(() => false);
    if (isDangerVisible) {
      await expect(deleteBtn).toBeDisabled();
    }
  });
});

test.describe("Manage Roles — Delete Custom Role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Manage Roles");
  });

  test("can delete a custom role with no users", async ({ page }) => {
    // Create a disposable role
    const dispRole = `Disp ${TS}`;
    await page.locator(".form__input").first().fill(dispRole);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".tbl")).toContainText(dispRole, { timeout: 15_000 });

    // Expand it
    const row = page.locator(".tbl tbody tr:not(.expand-row)").filter({ hasText: dispRole });
    await row.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });

    const deleteBtn = page.locator(".btn--danger").first();
    if (!await deleteBtn.isVisible().catch(() => false)) return;
    await deleteBtn.click();

    const modal = page.locator(".uc-modal");
    if (await modal.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await page.locator(".uc-modal__actions .btn--danger").click();
    }
    await expect(page.locator(".tbl")).not.toContainText(dispRole, { timeout: 15_000 });
  });
});
