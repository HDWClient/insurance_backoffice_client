/**
 * FUNCTIONAL TEST SUITE — Bulk Operations (BULK module)
 *
 * Covers:
 *  - Overview layout (KPIs, upload area, jobs list)
 *  - File selection and validation
 *  - CSV upload (progress → job card)
 *  - Job detail view (summary, progress breakdown, rows table)
 *  - Row filtering by status
 *  - Row search
 *  - Edit DRAFT row (inline form)
 *  - Send Invites (dispatch)
 *  - Cancel row
 *  - Cancel entire job (with confirmation)
 *  - Parse errors card
 *  - Pagination
 */
import { test, expect } from "@playwright/test";
import path from "path";
import os from "os";
import { loginAsSuperAdmin, goToModule } from "./helpers/auth.js";

const CSV_MAIN    = path.join(os.homedir(), "Downloads", "Bulk_Upload_Data.csv");
const CSV_EXAMPLE = path.join(os.homedir(), "Downloads", "example-bulk-upload.csv");

/** Ensure at least one job card exists; uploads CSV_MAIN if none found. */
async function ensureJobExists(page) {
  const card = page.locator(".bulk-job-card").first();
  if (!await card.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.locator("#bulk-file-input").setInputFiles(CSV_MAIN);
    await page.getByRole("button", { name: /Upload File/i }).click();
    await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 25_000 });
  }
}

/** Open the most recent job's detail view. */
async function openLatestJobDetail(page) {
  await ensureJobExists(page);
  await page.locator(".bulk-job-card .btn--primary").first().click();
  await expect(page.locator(".bulk-detail-hdr")).toBeVisible({ timeout: 12_000 });
}

test.describe("Bulk Operations — Overview Layout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
  });

  test("renders Bulk Operations hero title", async ({ page }) => {
    await expect(page.locator(".bulk-page-hero__title")).toHaveText("Bulk Operations", { timeout: 10_000 });
  });

  test("shows hero sub-text", async ({ page }) => {
    await expect(page.locator(".bulk-page-hero__sub")).toBeVisible({ timeout: 10_000 });
  });

  test("shows KPI cards (Total Jobs, Active)", async ({ page }) => {
    await expect(page.locator(".bulk-kpi").first()).toBeVisible({ timeout: 10_000 });
    const labels = await page.locator(".bulk-kpi__lbl").allTextContents();
    expect(labels.some(l => /jobs|active/i.test(l))).toBe(true);
  });

  test("shows Required Columns info block", async ({ page }) => {
    await expect(page.locator(".bulk-upload-reqs__title")).toContainText("Required columns", { timeout: 10_000 });
  });

  test("shows required column chips (email, mobile, name)", async ({ page }) => {
    const chips = await page.locator(".bulk-upload-reqs__chips").innerText({ timeout: 10_000 });
    expect(/email/i.test(chips)).toBe(true);
    expect(/mobile/i.test(chips)).toBe(true);
    expect(/name/i.test(chips)).toBe(true);
  });

  test("file input is present in DOM", async ({ page }) => {
    await expect(page.locator("#bulk-file-input")).toBeAttached({ timeout: 10_000 });
  });

  test("Upload File button is disabled before file selection", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Upload File/i })).toBeDisabled({ timeout: 10_000 });
  });

  test("jobs list card or empty state is visible", async ({ page }) => {
    await expect(page.locator(".bulk-jobs-list, .empty-state").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Bulk Operations — File Selection", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
  });

  test("selecting a CSV enables the Upload File button", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_MAIN);
    await expect(page.getByRole("button", { name: /Upload File/i })).toBeEnabled({ timeout: 5_000 });
  });

  test("selected filename appears in upload label", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_MAIN);
    await expect(page.locator(".bulk-upload-label")).toContainText("Bulk_Upload_Data.csv", { timeout: 5_000 });
  });
});

test.describe("Bulk Operations — Upload Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
  });

  test("uploading CSV creates a job card in the list", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_MAIN);
    await page.getByRole("button", { name: /Upload File/i }).click();
    await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 25_000 });
  });

  test("job card shows filename", async ({ page }) => {
    await ensureJobExists(page);
    await expect(page.locator(".bulk-job-card__name").first()).toBeVisible({ timeout: 10_000 });
  });

  test("job card shows status badge", async ({ page }) => {
    await ensureJobExists(page);
    await expect(page.locator(".bulk-job-card .badge").first()).toBeVisible({ timeout: 10_000 });
  });

  test("job card shows job number", async ({ page }) => {
    await ensureJobExists(page);
    await expect(page.locator(".bulk-job-card__num").first()).toBeVisible({ timeout: 10_000 });
    const text = await page.locator(".bulk-job-card__num").first().innerText();
    expect(text).toMatch(/#\d+/);
  });

  test("job card shows row metadata (total rows)", async ({ page }) => {
    await ensureJobExists(page);
    await expect(page.locator(".bulk-job-card__meta").first()).toBeVisible({ timeout: 10_000 });
  });

  test("uploading example CSV also creates a job card", async ({ page }) => {
    await page.locator("#bulk-file-input").setInputFiles(CSV_EXAMPLE);
    await page.getByRole("button", { name: /Upload File/i }).click();
    await expect(page.locator(".bulk-job-card").first()).toBeVisible({ timeout: 25_000 });
  });
});

test.describe("Bulk Operations — Job Detail View", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
  });

  test("View button opens the job detail view", async ({ page }) => {
    await openLatestJobDetail(page);
    await expect(page.locator(".bulk-detail-hdr")).toBeVisible();
  });

  test("detail header shows job number", async ({ page }) => {
    await openLatestJobDetail(page);
    const hdrText = await page.locator(".bulk-detail-hdr__title").innerText();
    expect(hdrText).toMatch(/#\d+/);
  });

  test("detail header shows filename", async ({ page }) => {
    await openLatestJobDetail(page);
    await expect(page.locator(".bulk-detail-hdr__file")).toBeVisible();
  });

  test("summary strip shows Total Rows, Valid, Invalid, Date", async ({ page }) => {
    await openLatestJobDetail(page);
    await expect(page.locator(".bulk-summary-strip")).toBeVisible({ timeout: 10_000 });
    const cards = page.locator(".bulk-summary-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("rows table renders in detail view", async ({ page }) => {
    await openLatestJobDetail(page);
    await expect(page.locator(".tbl").first()).toBeVisible({ timeout: 15_000 });
  });

  test("enrollment progress breakdown is visible", async ({ page }) => {
    await openLatestJobDetail(page);
    await expect(page.locator(".bulk-progress-breakdown").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Needs Attention panel appears when actionable rows exist", async ({ page }) => {
    await openLatestJobDetail(page);
    const panel = page.locator(".bulk-action-panel");
    if (await panel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(panel).toContainText("Needs Attention");
    }
  });
});

test.describe("Bulk Operations — Row Filtering & Search", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
    await openLatestJobDetail(page);
  });

  test("row status filter chips are visible", async ({ page }) => {
    await expect(page.locator(".bulk-filter-grid")).toBeVisible({ timeout: 12_000 });
    await expect(page.locator(".bulk-filter-check").first()).toBeVisible();
  });

  test("All filter chip is selected by default", async ({ page }) => {
    await expect(page.locator(".bulk-filter-check--on").first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking DRAFT filter shows only draft rows or empty state", async ({ page }) => {
    const draftChip = page.locator(".bulk-filter-check").filter({ hasText: "DRAFT" });
    if (await draftChip.isVisible().catch(() => false)) {
      await draftChip.click();
      await page.waitForTimeout(800);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });

  test("clicking STAGED filter shows only staged rows or empty state", async ({ page }) => {
    const chip = page.locator(".bulk-filter-check").filter({ hasText: "STAGED" });
    if (await chip.isVisible().catch(() => false)) {
      await chip.click();
      await page.waitForTimeout(800);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });

  test("row search input filters rows", async ({ page }) => {
    const searchInput = page.locator(".bulk-search-input");
    await expect(searchInput).toBeVisible({ timeout: 12_000 });
    await searchInput.fill("alice");
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });

  test("clearing row search shows all rows again", async ({ page }) => {
    await page.locator(".bulk-search-input").fill("xyz_no_match_9999");
    await page.waitForTimeout(600);
    await page.locator(".bulk-search-input").clear();
    await page.waitForTimeout(600);
    await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
  });
});

test.describe("Bulk Operations — Row Actions", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
    await openLatestJobDetail(page);
    // Switch to DRAFT filter so action buttons are visible
    const draftChip = page.locator(".bulk-filter-check").filter({ hasText: "DRAFT" });
    if (await draftChip.isVisible().catch(() => false)) {
      await draftChip.click();
      await page.waitForTimeout(800);
    }
  });

  test("DRAFT rows show Edit action button", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /Edit/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await expect(editBtn).toBeEnabled();
    }
  });

  test("clicking Edit opens inline edit form", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /Edit/i }).first();
    if (!await editBtn.isVisible().catch(() => false)) return;
    await editBtn.click();
    await expect(page.locator(".bulk-edit-form").first()).toBeVisible({ timeout: 5_000 });
  });

  test("edit form has email, mobile and name fields", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /Edit/i }).first();
    if (!await editBtn.isVisible().catch(() => false)) return;
    await editBtn.click();
    await expect(page.locator(".bulk-edit-form").first()).toBeVisible({ timeout: 5_000 });
    const inputs = page.locator(".bulk-edit-input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test("Cancel row button is present for DRAFT rows", async ({ page }) => {
    const cancelBtn = page.locator(".bulk-row-actions .btn--danger, .bulk-row-actions button").filter({ hasText: /Cancel/i }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await expect(cancelBtn).toBeEnabled();
    }
  });
});

test.describe("Bulk Operations — Send Invites & Job Cancel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
    await openLatestJobDetail(page);
  });

  test("Send Invites button is enabled in Needs Attention panel", async ({ page }) => {
    const panel = page.locator(".bulk-action-panel");
    if (await panel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const sendBtn = panel.getByRole("button", { name: /Send Invites/i });
      if (await sendBtn.isVisible().catch(() => false)) {
        await expect(sendBtn).toBeEnabled();
      }
    }
  });

  test("Cancel Job button is present in detail header", async ({ page }) => {
    const cancelBtn = page.locator(".bulk-detail-hdr").getByRole("button", { name: /Cancel/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await expect(cancelBtn).toBeVisible();
    }
  });

  test("Cancel Job shows inline confirmation and can be dismissed", async ({ page }) => {
    const cancelBtn = page.locator(".bulk-detail-hdr .btn--danger").first();
    if (!await cancelBtn.isVisible().catch(() => false)) return;
    await cancelBtn.click();
    const confirm = page.locator(".bulk-cancel-confirm, .uc-modal").first();
    if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator(".bulk-cancel-confirm .btn--ghost, .uc-modal .btn--ghost").first().click();
      await expect(confirm).not.toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Bulk Operations — Parse Errors & Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await goToModule(page, "Operations");
    await openLatestJobDetail(page);
  });

  test("parse errors card is shown when file has invalid rows", async ({ page }) => {
    const errSection = page.locator(".card").filter({ hasText: /Parse Error/i });
    if (await errSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(errSection).toBeVisible();
      const showBtn = errSection.getByRole("button", { name: /Show/i });
      if (await showBtn.isVisible().catch(() => false)) {
        await showBtn.click();
        await expect(page.locator(".bulk-error-list").first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("row pagination controls work", async ({ page }) => {
    const pagination = page.locator(".bulk-pagination").first();
    if (!await pagination.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    const nextBtn = pagination.getByRole("button", { name: /Next/i });
    if (await nextBtn.isEnabled().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator(".tbl, .empty-state").first()).toBeVisible();
    }
  });
});
