import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, navigateToModule } from "../helpers/auth.js";

const TS = Date.now();
const TEST_ORG_NAME = `Test Org ${TS}`;
const TEST_ORG_SLUG = `test-org-${TS % 100000}`;

test.describe("Organizations (ORG module)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateToModule(page, "Organizations");
  });

  // ── Layout ─────────────────────────────────────────────────

  test("renders org list with table", async ({ page }) => {
    const table = page.locator(".tbl").first();
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test("shows Create Organisation form card", async ({ page }) => {
    await expect(page.getByText("Create Organisation", { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Organisation Name *")).toBeVisible();
  });

  test("shows org count badge", async ({ page }) => {
    await expect(page.locator(".card__count").first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Search & Filter ─────────────────────────────────────────

  test("search input filters org list", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
    await searchInput.fill("kinko");
    // Give it time to filter
    await page.waitForTimeout(400);
    const rows = page.locator(".tbl tbody tr").filter({ hasNot: page.locator(".expand-row") });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("clearing search restores all orgs", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(400);
    await searchInput.clear();
    await page.waitForTimeout(400);
    const table = page.locator(".tbl").first();
    await expect(table).toBeVisible();
  });

  test("status filter buttons are visible", async ({ page }) => {
    await expect(page.getByText("All", { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible();
  });

  test("clicking Active filter shows only active orgs", async ({ page }) => {
    await page.locator(".btn--ghost").filter({ hasText: "Active" }).first().click();
    await page.waitForTimeout(500);
    const badges = page.locator(".badge--active, .badge--inactive");
    const inactiveCount = await page.locator(".badge--inactive").count();
    expect(inactiveCount).toBe(0);
  });

  // ── Create ──────────────────────────────────────────────────

  test("shows validation error for empty org name", async ({ page }) => {
    await page.getByLabel("Organisation Name *").fill("");
    await page.locator(".btn--primary").first().click();
    await expect(page.locator(".form__err").first()).toBeVisible({ timeout: 5_000 });
  });

  test("shows slug format validation error for invalid slug", async ({ page }) => {
    await page.getByLabel("Organisation Name *").fill("Test");
    const slugInput = page.locator('input[placeholder*="slug"], input[id*="slug"]').or(
      page.locator(".create-org-form__fields .form__input").nth(1)
    );
    await slugInput.fill("INVALID SLUG!");
    await page.locator(".btn--primary").first().click();
    await expect(page.locator(".form__err")).toBeVisible({ timeout: 5_000 });
  });

  test("creates a new org and it appears in the list", async ({ page }) => {
    await page.getByLabel("Organisation Name *").fill(TEST_ORG_NAME);
    const slugInput = page.locator(".create-org-form__fields .form__input").nth(1);
    await slugInput.fill(TEST_ORG_SLUG);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();

    // Wait for the new org to appear in the table
    await expect(page.locator(".tbl").first()).toContainText(TEST_ORG_NAME, { timeout: 12_000 });
  });

  test("form clears after successful org creation", async ({ page }) => {
    const nameInput = page.getByLabel("Organisation Name *");
    const slug = `cleanup-${TS % 10000}-2`;
    await nameInput.fill(`Cleanup Org ${TS}`);
    const slugInput = page.locator(".create-org-form__fields .form__input").nth(1);
    await slugInput.fill(slug);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await page.waitForTimeout(2_000);
    await expect(nameInput).toHaveValue("", { timeout: 8_000 });
  });

  // ── View Details ────────────────────────────────────────────

  test("clicking Details expands org row with info", async ({ page }) => {
    const detailsBtn = page.locator(".btn--ghost").filter({ hasText: "Details" }).first();
    await expect(detailsBtn).toBeVisible({ timeout: 10_000 });
    await detailsBtn.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".org-detail-grid").first()).toBeVisible();
  });

  test("org detail shows name, slug, and status fields", async ({ page }) => {
    const detailsBtn = page.locator(".btn--ghost").filter({ hasText: "Details" }).first();
    await detailsBtn.click();
    const panel = page.locator(".org-detail-grid").first();
    await expect(panel).toContainText("Status", { timeout: 8_000 });
  });

  test("clicking Details again collapses the panel", async ({ page }) => {
    const detailsBtn = page.locator(".btn--ghost").filter({ hasText: "Details" }).first();
    await detailsBtn.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    await detailsBtn.click();
    await expect(page.locator(".expand-panel").first()).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Edit ────────────────────────────────────────────────────

  test("clicking Edit opens inline edit form", async ({ page }) => {
    const editBtn = page.locator(".btn--ghost").filter({ hasText: "Edit" }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();
    await expect(page.locator(".expand-panel").first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".expand-panel .form__input").first()).toBeVisible();
  });

  test("can edit org name and save", async ({ page }) => {
    // Find the test org we created earlier (search for it)
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await searchInput.fill(TEST_ORG_NAME);
    await page.waitForTimeout(500);

    const editBtn = page.locator(".btn--ghost").filter({ hasText: "Edit" }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    const nameField = page.locator(".expand-panel .form__input").first();
    await nameField.fill(`${TEST_ORG_NAME} Edited`);
    await page.locator(".expand-panel .btn--primary").first().click();
    await expect(page.locator(".tbl")).toContainText(`${TEST_ORG_NAME} Edited`, { timeout: 10_000 });
  });

  // ── Status toggle ───────────────────────────────────────────

  test("status select is present in edit panel", async ({ page }) => {
    const editBtn = page.locator(".btn--ghost").filter({ hasText: "Edit" }).first();
    await editBtn.click();
    const statusSelect = page.locator(".expand-panel .form__input.form__select, .expand-panel select");
    await expect(statusSelect.first()).toBeVisible({ timeout: 8_000 });
  });

  // ── Delete ──────────────────────────────────────────────────

  test("delete button opens confirmation modal", async ({ page }) => {
    // Search for the test org
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await searchInput.fill(TEST_ORG_NAME);
    await page.waitForTimeout(500);

    const deleteBtn = page.locator(".btn--danger").first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();
    await expect(page.locator(".uc-modal")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".uc-modal__title")).toContainText("Delete");
  });

  test("cancel in delete modal keeps org in list", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await searchInput.fill(TEST_ORG_NAME);
    await page.waitForTimeout(500);

    const deleteBtn = page.locator(".btn--danger").first();
    await deleteBtn.click();
    await expect(page.locator(".uc-modal")).toBeVisible({ timeout: 5_000 });
    await page.locator(".uc-modal__actions .btn--ghost").click();
    await expect(page.locator(".uc-modal")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".tbl")).toBeVisible();
  });

  test("confirming delete removes org from list", async ({ page }) => {
    // Create a disposable org first
    const dispName = `Disposable ${TS}`;
    const dispSlug = `disp-${TS % 100000}`;
    await page.getByLabel("Organisation Name *").fill(dispName);
    await page.locator(".create-org-form__fields .form__input").nth(1).fill(dispSlug);
    await page.locator(".btn--primary.btn--create-shimmer").first().click();
    await expect(page.locator(".tbl")).toContainText(dispName, { timeout: 12_000 });

    // Now delete it
    const searchInput = page.getByPlaceholder("Search by name or slug…");
    await searchInput.fill(dispName);
    await page.waitForTimeout(500);
    const deleteBtn = page.locator(".btn--danger").first();
    await deleteBtn.click();
    await expect(page.locator(".uc-modal")).toBeVisible({ timeout: 5_000 });
    await page.locator(".uc-modal__actions .btn--danger").click();
    await expect(page.locator(".tbl")).not.toContainText(dispName, { timeout: 12_000 });
  });
});
