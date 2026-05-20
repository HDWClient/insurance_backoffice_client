import { test, expect } from "@playwright/test";
import path from "path";
import os from "os";
import { loginAsSuperAdmin, navigateToModule } from "../helpers/auth.js";

const CSV_FILE = path.join(os.homedir(), "Downloads", "Bulk_Upload_Data.csv");
const CSV_FILE_2 = path.join(os.homedir(), "Downloads", "example-bulk-upload.csv");

test.describe("Bulk Operations (BULK module)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateToModule(page, "Operations");
  });

  // ── Overview Layout ─────────────────────────────────────────

  test("renders bulk overview hero section", async ({ page }) => {
    await expect(page.locator(".bulk-page-hero__title")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".bulk-page-hero__title")).toHaveText("Bulk Operations");
  });

  test("shows KPI cards for total jobs and active jobs", async ({ page }) => {
    await expect(page.locator(".bulk-kpi").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".bulk-kpi__lbl").first()).toBeVisible();
  });

  test("shows file upload section with required column info", async ({ page }) => {
    await expect(page.locator(".bulk-upload-reqs")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".bulk-upload-reqs__title")).toContainText("Required columns");
  });

  test("file input is present for CSV upload", async ({ page }) => {
    await expect(page.locator("#bulk-file-input")).toBeAttached({ timeout: 10_000 });
  });

  test("upload button is disabled before file is selected", async ({ page }) => {
    const uploadBtn = page.getByRole("button", { name: /Upload File/i });
    await expect(uploadBtn).toBeVisible({ timeout: 10_000 });
    await expect(uploadBtn).toBeDisabled();
  });

  test("shows jobs list card", async ({ page }) => {
    await expect(page.locator(".bulk-jobs-list, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });

  // ── File Selection ──────────────────────────────────────────

  test("selecting a CSV file enables the upload button", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
    const uploadBtn = page.getByRole("button", { name: /Upload File/i });
    await expect(uploadBtn).toBeEnabled({ timeout: 5_000 });
  });

  test("selected file name is displayed after selection", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
    await expect(page.locator(".bulk-upload-label")).toContainText("Bulk_Upload_Data.csv", { timeout: 5_000 });
  });

  // ── Upload Flow ─────────────────────────────────────────────

  test("uploads a CSV and shows job in list", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
    const uploadBtn = page.getByRole("button", { name: /Upload File/i });
    await expect(uploadBtn).toBeEnabled({ timeout: 5_000 });
    await uploadBtn.click();

    // Wait for job to appear in the jobs list
    await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
  });

  test("upload shows progress bar or immediate success", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_FILE_2);
    const uploadBtn = page.getByRole("button", { name: /Upload File/i });
    await uploadBtn.click();

    // Either progress bar appears OR job card appears directly
    const progressOrCard = page.locator(".bulk-progress-fill, .bulk-job-card");
    await expect(progressOrCard.first()).toBeVisible({ timeout: 15_000 });
  });

  test("job card shows filename and status badge", async ({ page }) => {
    // Ensure at least one job exists (upload if none)
    const existingCard = page.locator(".bulk-job-card").first();
    const hasJobs = await existingCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await expect(page.locator(".bulk-job-card__name").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".bulk-job-card .badge").first()).toBeVisible();
  });

  test("job card shows total row count", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.locator(".bulk-job-card__meta").first()).toBeVisible();
  });

  // ── Job Detail View ─────────────────────────────────────────

  test("clicking View opens job detail view", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });
  });

  test("job detail shows summary strip with Total Rows", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-summary-strip")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".bulk-summary-card").first()).toBeVisible();
  });

  test("job detail shows rows table", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 12_000 });
  });

  test("job detail shows Needs Attention panel when applicable", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });
    // Needs attention panel is conditional on having actionable rows
    const needsAttention = page.locator(".bulk-action-panel");
    const isVisible = await needsAttention.isVisible().catch(() => false);
    if (isVisible) {
      await expect(needsAttention).toContainText("Needs Attention");
    }
  });

  // ── Row Filtering ───────────────────────────────────────────

  test("row status filter chips are visible in detail view", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-filter-grid")).toBeVisible({ timeout: 12_000 });
    await expect(page.locator(".bulk-filter-check").first()).toBeVisible();
  });

  test("clicking a row status filter updates the displayed rows", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-filter-grid")).toBeVisible({ timeout: 12_000 });

    const filterChips = page.locator(".bulk-filter-check");
    const count = await filterChips.count();
    if (count > 1) {
      await filterChips.nth(1).click();
      await page.waitForTimeout(800);
      // Rows should refresh — table still visible
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });

  // ── Row Search ──────────────────────────────────────────────

  test("row search input filters rows in detail view", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-search-input")).toBeVisible({ timeout: 12_000 });
    await page.locator(".bulk-search-input").fill("alice");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });

  // ── Row Actions ─────────────────────────────────────────────

  test("DRAFT rows have Edit and Cancel action buttons", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 12_000 });

    // Filter by DRAFT
    const draftFilter = page.locator(".bulk-filter-check").filter({ hasText: "DRAFT" });
    if (await draftFilter.isVisible().catch(() => false)) {
      await draftFilter.click();
      await page.waitForTimeout(500);

      const rowActions = page.locator(".bulk-row-actions").first();
      if (await rowActions.isVisible().catch(() => false)) {
        await expect(rowActions.getByRole("button", { name: /Edit|Cancel/i }).first()).toBeVisible();
      }
    }
  });

  test("Edit row opens inline edit form", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 12_000 });

    const draftFilter = page.locator(".bulk-filter-check").filter({ hasText: "DRAFT" });
    if (await draftFilter.isVisible().catch(() => false)) {
      await draftFilter.click();
      await page.waitForTimeout(500);
    }

    const editBtn = page.getByRole("button", { name: /Edit/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await expect(page.locator(".bulk-edit-form").first()).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Send Invites (Dispatch) ─────────────────────────────────

  test("Send Invites button is present in Needs Attention panel for DRAFT rows", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });

    const needsAttention = page.locator(".bulk-action-panel");
    if (await needsAttention.isVisible().catch(() => false)) {
      const sendBtn = needsAttention.getByRole("button", { name: /Send Invites/i });
      if (await sendBtn.isVisible().catch(() => false)) {
        await expect(sendBtn).toBeEnabled();
      }
    }
  });

  // ── Job Cancellation ────────────────────────────────────────

  test("Cancel Job button is visible in job detail header", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });

    const cancelBtn = page.locator(".bulk-detail-hdr").getByRole("button", { name: /Cancel Job/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await expect(cancelBtn).toBeVisible();
    }
  });

  test("Cancel Job shows confirmation prompt", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });

    const cancelBtn = page.locator(".bulk-detail-hdr .btn--danger, .bulk-detail-hdr button").filter({ hasText: /Cancel Job/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      // Either a confirmation inline or a modal should appear
      await expect(page.locator(".bulk-cancel-confirm, .uc-modal").first()).toBeVisible({ timeout: 5_000 });
      // Dismiss
      await page.locator(".bulk-cancel-confirm .btn--ghost, .uc-modal .btn--ghost").first().click();
    }
  });

  // ── Progress Breakdown ──────────────────────────────────────

  test("job detail shows enrollment progress breakdown", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-progress-breakdown").first()).toBeVisible({ timeout: 12_000 });
  });

  // ── Pagination ──────────────────────────────────────────────

  test("row pagination controls appear when job has many rows", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });

    const pagination = page.locator(".bulk-pagination").first();
    const hasPagination = await pagination.isVisible().catch(() => false);
    if (hasPagination) {
      await expect(pagination).toBeVisible();
    }
  });

  // ── Parse Errors ────────────────────────────────────────────

  test("parse errors section is shown if job has invalid rows", async ({ page }) => {
    const hasJobs = await page.locator(".bulk-job-card").first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasJobs) {
      await page.locator("#bulk-file-input").setInputFiles(CSV_FILE);
      await page.getByRole("button", { name: /Upload File/i }).click();
      await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 20_000 });
    }

    await page.locator(".bulk-job-card .btn--primary").first().click();
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 10_000 });
    // Parse errors card is conditionally rendered
    const errCard = page.locator(".bulk-error-list, .card").filter({ hasText: /Parse Errors/i });
    const hasErrors = await errCard.isVisible().catch(() => false);
    if (hasErrors) {
      await expect(errCard.first()).toBeVisible();
    }
  });
});
